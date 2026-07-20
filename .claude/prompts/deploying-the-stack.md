# Prompt: plan deployment

> **Execution Directive:** Implement via the `fnb-stack-implementor` and `fnb-stack-spec` skills.
> Invoke: `/fnb-stack-spec /fnb-stack-implementor <this-file>`

we need to be able to deploy to at least two environments:

- a digital ocean droplet
- aws

### digital ocean
- would like to deploy all services inside one docker container that includes the nginx broker.  docker in docker?
- a postgres instance would be needed as well
- what is best storage approach for files?

### AWS
- this could use other services on aws.  i want you to recommend the best approach

### method
ideally, terraform should be used for the actual deployments to each environment

i think a new top-level directory would be the best landing spot for final artifacts

i expect you to have several good questions for me about how this will work out