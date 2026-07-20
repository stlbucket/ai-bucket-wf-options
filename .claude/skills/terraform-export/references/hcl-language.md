# HCL — the Terraform configuration language

Declarative: you describe the *goal*, not the steps. Everything is **blocks**, **arguments**
(name = value inside a block), and **expressions** (values / references). A directory of `.tf`
files is the **root module**; block ordering and file split are insignificant — Terraform loads
every `.tf` in the dir together. `.tf.json` is the JSON variant; `override.tf` / `*_override.tf`
merge over the primary files (use sparingly).

## The block types

```hcl
terraform {                              # settings: versions, backend, required_providers
  required_version = ">= 1.7"
  required_providers { aws = { source = "hashicorp/aws", version = "~> 5.0" } }
  backend "s3" { /* ... */ }             # at most one backend block
}

provider "aws" { region = var.region }   # configures a provider

resource "aws_vpc" "main" {              # a MANAGED object Terraform creates/updates/destroys
  cidr_block = var.base_cidr_block
}

data "aws_ami" "ubuntu" {                # a data source: READS existing info, creates nothing
  most_recent = true
  owners      = ["099720109477"]
}

variable "region" { type = string }      # input (see modules-variables-outputs.md)
output  "vpc_id"  { value = aws_vpc.main.id }
locals  { name_prefix = "fnb-${var.environment}" }

module "vpc" { source = "./modules/vpc"  /* ... */ }   # calls a child module
```

**Resource vs data source** — a `resource` is in Terraform's lifecycle (it will be created,
changed, and destroyed to match config). A `data` source only *fetches* attributes of something
that already exists (an AMI, an existing DNS zone). Data sources never appear in a destroy plan.

## Resource meta-arguments

Meta-arguments work on `resource`, and most on `module`, blocks. Style: list them **first**.

- **`count = N`** — create N instances; reference as `aws_x.y[0]`, index via `count.index`.
- **`for_each = <map|set>`** — create one instance per element; reference as `aws_x.y["key"]`,
  and inside use `each.key` / `each.value`. Prefer `for_each` over `count` when items have stable
  identities (adding/removing a middle element with `count` re-indexes and churns everything).
  You cannot use both on the same block.
- **`provider = aws.useast`** — pick a non-default (aliased) provider config.
- **`depends_on = [aws_x.y]`** — explicit ordering for a dependency Terraform can't infer from
  references. Last resort; implicit (reference-based) dependencies are preferred.
- **`lifecycle { … }`** — `create_before_destroy = true`, `prevent_destroy = true` (guards
  stateful resources like managed PG), `ignore_changes = [tags]`, `replace_triggered_by = [...]`.

```hcl
resource "aws_subnet" "private" {
  for_each          = var.private_subnets            # map(string) cidr by AZ
  vpc_id            = aws_vpc.main.id
  availability_zone = each.key
  cidr_block        = each.value

  lifecycle { create_before_destroy = true }
}
```

## Expressions (the parts you actually reach for)

**References to named values:** `var.x`, `local.x`, `module.m.out`, `data.type.name.attr`,
`aws_type.name.attr`, `each.key`/`each.value`, `count.index`, `path.module`/`path.root`,
`terraform.workspace`.

**String templates:** `"${var.env}-web"`. Directives: `%{ if x }…%{ else }…%{ endif }`,
`%{ for a in list }…%{ endfor }`.

**Conditional:** `var.create ? 1 : 0` (the classic `count` toggle).

**`for` expressions** — list/map comprehensions:
```hcl
[for s in var.names : upper(s)]                        # -> list
{for k, v in var.m : k => v.id}                        # -> map
[for s in var.names : s if s != ""]                    # with filter
```

**Splat:** `aws_instance.web[*].id` — collapse a `count`/`for_each` set to a list of one attr.

**`dynamic` blocks** — generate repeated *nested* blocks (you can't `for_each` a nested block
directly):
```hcl
resource "aws_security_group" "web" {
  name = "web"
  dynamic "ingress" {
    for_each = var.ingress_ports                        # e.g. toset([80, 443])
    content {
      from_port   = ingress.value
      to_port     = ingress.value
      protocol    = "tcp"
      cidr_blocks = ["0.0.0.0/0"]
    }
  }
}
```

**Handy built-in functions:** `merge`, `lookup`, `coalesce`, `try` (swallow errors / provide
fallback), `toset`/`tolist`/`tomap`, `jsonencode`/`jsondecode`, `templatefile(path, vars)`,
`format`/`formatlist`, `join`/`split`, `cidrsubnet`/`cidrhost`, `base64encode`, `file`,
`fileset`, `regex`. Test any of them live in `terraform console`.

## Gotchas

- **`count` re-indexing churn** — removing element 0 of a `count` list shifts every later index →
  Terraform plans to replace them all. Use `for_each` with stable keys for anything mutable.
- **Data sources read at plan time** — a `data` block that depends on a not-yet-created resource
  can fail the plan; gate it with `depends_on` or split the apply.
- **`ignore_changes` hides real drift** — use it only for values a controller mutates out-of-band
  (e.g. autoscaling desired count), never to paper over a config bug.
- **No imperative logic** — there are no loops/if-statements as statements; everything is
  expressions (`for`, conditionals, `dynamic`). Trying to write procedural code is the #1 HCL
  mistake.
