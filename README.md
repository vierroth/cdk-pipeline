This library exposes a highly customizable and extensible L3 pipeline construct intended as an alternative to the CDK native L3 [CodePipeline](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.pipelines.CodePipeline.html) construct which has some inherent limitations in capability and extensibility.

The documentation provides the tools and documentation to get your own pipeline up and running and build your own custom segments.

## Usage

### Installation

The package is available on [NPM](https://www.npmjs.com/package/@flit/cdk-pipeline) and can be installed using your package manager of choice:

```bash
npm i @flit/cdk-pipeline
```

```bash
pnpm add @flit/cdk-pipeline
```

```bash
yarn add @flit/cdk-pipeline
```

### Core concepts

#### - [Example Project](https://github.com/vierroth/cdk-pipeline/blob/main/example/README.md)

To better understand the core concepts take a look at the included [example project](https://github.com/vierroth/cdk-pipeline/blob/main/example/README.md).

#### - Pipeline

The `Pipeline` construct will create a CloudFormation Stack which contains the pipeline and all of the required peripheral resources to make it work.

#### - Segment

A `Segment` is simply a pre-configured set of pipeline actions which together represent a commonly used CI/CD pattern, like for example building and deploying a stack.

To build properly, a Pipeline requires at least one SourceSegment, exactly one PipelineSegment and at least one other segment.

#### - Artifact

An `Artifact` represents a pipeline artifact which can be used to pass information between stages. Every artifact needs to be the output of exactly one Segment and can be consumed by any segments that need that output.
