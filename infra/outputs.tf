output "swarm_manager_ip" {
  description = "Public IP of the Swarm manager EC2 instance"
  value       = aws_instance.swarm_manager.public_ip
}

output "rds_endpoint" {
  description = "PostgreSQL endpoint for the MedShop DB"
  value       = aws_db_instance.medshop.endpoint
}

output "swarm_worker_ip" {
  description = "Public IP of the Swarm worker EC2 instance"
  value       = aws_instance.swarm_worker.public_ip
}
