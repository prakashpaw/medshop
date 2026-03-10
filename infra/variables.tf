variable "region" {
  description = "AWS region"
  default     = "ap-south-1"
}

variable "instance_type" {
  description = "EC2 instance type for Swarm manager"
  default     = "t3.micro"
}

variable "db_password" {
  description = "PostgreSQL password (minimum 8 characters)"
  type        = string
  sensitive   = true
  validation {
    condition     = length(var.db_password) >= 8 && can(regex("^[a-zA-Z0-9!#$%^&*()-_=+[\\]{}|;:',.<>?]+$", var.db_password))
    error_message = "The password must be at least 8 characters long and contain only printable ASCII characters besides '/', '@', '\"', or spaces."
  }
}
