## Usage

### Setup

To deploy this example for yourself you will first have to fork this repository and then [connect your AWS account with your GitHub account](https://docs.aws.amazon.com/codepipeline/latest/userguide/connections-github.html) making sure to give the connection access to the fork of this repository.

[!IMPORTANT]
Make sure to give the connection access to your fork of this repository!

One you have forked the repository and connected your GitHub to AWS you need to update the pipeline configuration to include your GitHub connection as pipeline source:

#### `example/src/index.ts`

```typescript
40 new CodeStarSourceSegment({
41   output: SOURCE_ARTIFACT,
42   connectionArn: "*** Your GitHub connection ARN ***",
43   owner: "*** Your GitHub account Name (eg. vierroth) ***",
44   repository: "*** The name of the forked repository (eg. cdk-pipeline) ***",
45   branch: "main",
46 }),
```

[!IMPORTANT]
Make sure to deploy those changes to GitHub before proceeding!

### Initial Deployment

One you have completed the setup and deployed the changes you can use `npm` or an alternative package manager of your choice, in the repositories root directory, to install any required packages and build the the project:

```bash
npm ci
npm run build
```

Once the project has built you can navigate to the example directory and run the initial pipeline deployment:

```bash
npx cdk deploy ExamplePipeline
```

[!IMPORTANT]
The initial deployment steps only have to be run once, from then on the pipeline will automatically run every time a change is made to the repository on GitHub!

### Next steps

No that the pipeline is deployed you can go into your AWS account and take a look. The pipeline will rerun any time a change is pushed to the main branch of the fork on GitHub, so maybe you can make a modification to one of the stacks and push it to see what the pipeline will do.
