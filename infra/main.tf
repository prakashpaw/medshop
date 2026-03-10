provider "aws" {
  region = var.region
}

terraform {
  backend "s3" {
    bucket = "medshop-tfstate-bucket-2026" # We will create this bucket first
    key    = "medshop/terraform.tfstate"
    region = "ap-south-1"
  }
}

resource "aws_vpc" "main" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_support   = true
  enable_dns_hostnames = true
}

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }
}

resource "aws_subnet" "public_1" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.1.0/24"
  availability_zone = "${var.region}a"
  map_public_ip_on_launch = true
}

resource "aws_subnet" "public_2" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.2.0/24"
  availability_zone = "${var.region}b"
  map_public_ip_on_launch = true
}

resource "aws_route_table_association" "public_1" {
  subnet_id      = aws_subnet.public_1.id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table_association" "public_2" {
  subnet_id      = aws_subnet.public_2.id
  route_table_id = aws_route_table.public.id
}

resource "aws_security_group" "allow_http" {
  name        = "allow_http"
  description = "Allow inbound HTTP/HTTPS and DB"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 3000
    to_port     = 3000
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "tls_private_key" "main" {
  algorithm = "RSA"
  rsa_bits  = 4096
}

resource "aws_key_pair" "medshop_auto" {
  key_name   = "medshop-auto"
  public_key = tls_private_key.main.public_key_openssh
}

resource "local_file" "ssh_key" {
  filename        = "${path.module}/../medshop_auto.pem"
  content         = tls_private_key.main.private_key_pem
  file_permission = "0400"
}

data "aws_ami" "amazon_linux_2" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["amzn2-ami-hvm-*-x86_64-gp2"]
  }
}

resource "aws_instance" "swarm_manager" {
  ami           = data.aws_ami.amazon_linux_2.id
  instance_type = var.instance_type
  subnet_id     = aws_subnet.public_1.id
  key_name      = aws_key_pair.medshop_auto.key_name
  associate_public_ip_address = true
  vpc_security_group_ids = [aws_security_group.allow_http.id]

  user_data = <<-EOF
    #!/bin/bash
    yum update -y
    amazon-linux-extras install docker -y
    service docker start
    docker swarm init
  EOF

  tags = {
    Name = "medshop-swarm-manager"
  }
}

resource "aws_eip" "manager_ip" {
  instance = aws_instance.swarm_manager.id
  domain   = "vpc"

  tags = {
    Name = "medshop-manager-eip"
  }
}

resource "aws_instance" "swarm_worker" {
  ami           = data.aws_ami.amazon_linux_2.id
  instance_type = var.instance_type
  subnet_id     = aws_subnet.public_2.id # Placing in a different AZ for high availability
  key_name      = aws_key_pair.medshop_auto.key_name
  associate_public_ip_address = true
  vpc_security_group_ids = [aws_security_group.allow_http.id]

  user_data = <<-EOF
    #!/bin/bash
    yum update -y
    amazon-linux-extras install docker -y
    service docker start
  EOF

  tags = {
    Name = "medshop-swarm-worker"
  }
}

resource "aws_db_subnet_group" "medshop" {
  name       = "medshop-v3"
  subnet_ids = [aws_subnet.public_1.id, aws_subnet.public_2.id]
}

resource "aws_db_instance" "medshop" {
  allocated_storage       = 20
  engine                  = "postgres"
  engine_version          = "15"
  instance_class          = "db.t3.micro"
  db_name                 = "medshop"
  username                = "medadmin"
  password                = var.db_password
  skip_final_snapshot     = true
  publicly_accessible     = true
  vpc_security_group_ids  = [aws_security_group.allow_http.id]
  db_subnet_group_name    = aws_db_subnet_group.medshop.name
}
