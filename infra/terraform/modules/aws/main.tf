# AWS environment (spec environment-aws.md §2): EC2 lift-and-shift — one instance runs the IDENTICAL
# prod Compose stack as DO, backed by RDS + S3. Same shape as the digitalocean module with
# EC2⇄droplet, RDS⇄Managed PG, S3⇄Spaces, ECR⇄DOCR, Route 53⇄DO DNS. Caddy fronts TLS; zitadel/n8n
# are reached THROUGH Caddy (raw ports closed on the SG).
#
# Secrets discipline (spec §3): SSM SecureString params are created OUT OF BAND (aws CLI) so their
# values never enter Terraform state; this module only GRANTS the instance role read on /fnb/<env>/*.
# (RDS master password is the one secret that must reach RDS — passed via TF_VAR, sensitive, in
# state; keep the state backend encrypted.)

data "aws_caller_identity" "current" {}

data "aws_availability_zones" "available" {
  state = "available"
}

data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"] # Canonical
  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd*/ubuntu-noble-24.04-amd64-server-*"]
  }
  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

locals {
  name          = "fnb-${var.environment}"
  bucket        = var.bucket_name != "" ? var.bucket_name : "fnb-assets-${var.environment}"
  azs           = slice(data.aws_availability_zones.available.names, 0, 2)
  registry_host = "${data.aws_caller_identity.current.account_id}.dkr.ecr.${var.region}.amazonaws.com"
  fqdn_id       = "${var.subdomain_id}.${var.domain}"
  fqdn_n8n      = "${var.subdomain_n8n}.${var.domain}"
}

# ── Network: VPC, IGW, 1 public subnet (EC2), 2 private subnets (RDS) ─────────
resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true
  tags                 = { Name = local.name }
}

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id
  tags   = { Name = local.name }
}

resource "aws_subnet" "public" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = cidrsubnet(var.vpc_cidr, 8, 0)
  availability_zone       = local.azs[0]
  map_public_ip_on_launch = true
  tags                    = { Name = "${local.name}-public" }
}

resource "aws_subnet" "private" {
  count             = 2
  vpc_id            = aws_vpc.main.id
  cidr_block        = cidrsubnet(var.vpc_cidr, 8, count.index + 10)
  availability_zone = local.azs[count.index]
  tags              = { Name = "${local.name}-private-${count.index}" }
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }
  tags = { Name = "${local.name}-public" }
}

resource "aws_route_table_association" "public" {
  subnet_id      = aws_subnet.public.id
  route_table_id = aws_route_table.public.id
}

# ── Security groups ──────────────────────────────────────────────────────────
resource "aws_security_group" "ec2" {
  name        = "${local.name}-ec2"
  description = "Caddy 80/443 open; SSH admin-only; egress all."
  vpc_id      = aws_vpc.main.id

  ingress {
    description = "HTTP"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  ingress {
    description = "HTTPS"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  ingress {
    description = "SSH (admin CIDRs only)"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = var.admin_ssh_cidrs
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  tags = { Name = "${local.name}-ec2" }
}

resource "aws_security_group" "rds" {
  name        = "${local.name}-rds"
  description = "Postgres 5432 from the EC2 SG only."
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "Postgres from EC2"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.ec2.id]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  tags = { Name = "${local.name}-rds" }
}

# ── IAM: instance role (ECR pull + SSM read on /fnb/<env>/*) ──────────────────
resource "aws_iam_role" "ec2" {
  name = "${local.name}-ec2"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ec2.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "ecr_pull" {
  role       = aws_iam_role.ec2.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly"
}

resource "aws_iam_role_policy" "ssm_read" {
  name = "${local.name}-ssm-read"
  role = aws_iam_role.ec2.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["ssm:GetParameter", "ssm:GetParameters", "ssm:GetParametersByPath"]
      Resource = "arn:aws:ssm:${var.region}:${data.aws_caller_identity.current.account_id}:parameter/fnb/${var.environment}/*"
    }]
  })
}

resource "aws_iam_instance_profile" "ec2" {
  name = "${local.name}-ec2"
  role = aws_iam_role.ec2.name
}

# ── EC2 (Compose host) + Elastic IP ──────────────────────────────────────────
resource "aws_instance" "web" {
  ami                         = data.aws_ami.ubuntu.id
  instance_type               = var.instance_type
  subnet_id                   = aws_subnet.public.id
  vpc_security_group_ids      = [aws_security_group.ec2.id]
  iam_instance_profile        = aws_iam_instance_profile.ec2.name
  key_name                    = var.key_name != "" ? var.key_name : null
  associate_public_ip_address = true
  user_data                   = file("${path.module}/cloud-init.yaml")

  root_block_device {
    volume_size = 40
    volume_type = "gp3"
    encrypted   = true
  }
  tags = { Name = local.name }
}

resource "aws_eip" "web" {
  instance = aws_instance.web.id
  domain   = "vpc"
  tags     = { Name = local.name }
}

# ── RDS Postgres (private subnets; PostGIS via CREATE EXTENSION under the master) ─
resource "aws_db_subnet_group" "pg" {
  name       = local.name
  subnet_ids = aws_subnet.private[*].id
  tags       = { Name = local.name }
}

resource "aws_db_instance" "pg" {
  identifier             = local.name
  engine                 = "postgres"
  engine_version         = var.pg_version
  instance_class         = var.db_instance_class
  allocated_storage      = var.db_allocated_storage
  storage_encrypted      = true
  db_name                = var.app_db_name
  username               = var.db_username
  password               = var.db_password
  db_subnet_group_name   = aws_db_subnet_group.pg.name
  vpc_security_group_ids = [aws_security_group.rds.id]
  publicly_accessible    = false
  skip_final_snapshot    = true
  apply_immediately      = true
  tags                   = { Name = local.name }
}

# ── S3 (object storage) ──────────────────────────────────────────────────────
resource "aws_s3_bucket" "assets" {
  bucket = local.bucket
  tags   = { Name = local.bucket }
}

# Block public ACLs but ALLOW the bucket policy (so anon read on public/* works).
resource "aws_s3_bucket_public_access_block" "assets" {
  bucket                  = aws_s3_bucket.assets.id
  block_public_acls       = true
  ignore_public_acls      = true
  block_public_policy     = false
  restrict_public_buckets = false
}

resource "aws_s3_bucket_policy" "assets" {
  bucket     = aws_s3_bucket.assets.id
  depends_on = [aws_s3_bucket_public_access_block.assets]
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "PublicReadPublicPrefix"
      Effect    = "Allow"
      Principal = "*"
      Action    = ["s3:GetObject"]
      Resource  = ["${aws_s3_bucket.assets.arn}/public/*"]
    }]
  })
}

resource "aws_s3_bucket_lifecycle_configuration" "assets" {
  bucket = aws_s3_bucket.assets.id
  rule {
    id     = "expire-quarantine"
    status = "Enabled"
    filter {
      prefix = "quarantine/"
    }
    expiration {
      days = var.quarantine_expire_days
    }
  }
}

resource "aws_s3_bucket_cors_configuration" "assets" {
  bucket = aws_s3_bucket.assets.id
  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "PUT", "POST", "HEAD"]
    allowed_origins = ["https://${var.domain}"]
    max_age_seconds = 3600
  }
}

# Optional CloudFront in front of S3 (default *.cloudfront.net cert — no ACM/us-east-1 needed).
resource "aws_cloudfront_distribution" "assets" {
  count   = var.enable_cdn ? 1 : 0
  enabled = true

  origin {
    domain_name = aws_s3_bucket.assets.bucket_regional_domain_name
    origin_id   = "s3-assets"
  }

  default_cache_behavior {
    target_origin_id       = "s3-assets"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }
}

# ── ECR: one repo per app image ──────────────────────────────────────────────
resource "aws_ecr_repository" "app" {
  for_each             = toset(var.app_images)
  name                 = each.value
  image_tag_mutability = "MUTABLE"
  force_delete         = true
}

# ── Route 53: hosted zone + apex/id/n8n → the EIP ────────────────────────────
# Delegate the domain's NS records to this zone's nameservers (the user's one-time step).
resource "aws_route53_zone" "main" {
  name = var.domain
}

resource "aws_route53_record" "root" {
  zone_id = aws_route53_zone.main.zone_id
  name    = var.domain
  type    = "A"
  ttl     = 300
  records = [aws_eip.web.public_ip]
}

resource "aws_route53_record" "id" {
  zone_id = aws_route53_zone.main.zone_id
  name    = local.fqdn_id
  type    = "A"
  ttl     = 300
  records = [aws_eip.web.public_ip]
}

resource "aws_route53_record" "n8n" {
  zone_id = aws_route53_zone.main.zone_id
  name    = local.fqdn_n8n
  type    = "A"
  ttl     = 300
  records = [aws_eip.web.public_ip]
}
