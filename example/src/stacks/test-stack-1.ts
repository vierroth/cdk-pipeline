import { Stack, StackProps } from "aws-cdk-lib";
import { Code, Runtime } from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Construct } from "constructs";

export interface TestStack1Props extends StackProps {}

export class TestStack1 extends Stack {
  constructor(scope: Construct, id: string, props: TestStack1Props) {
    super(scope, id, props);

    new NodejsFunction(this, "TestLambda1", {
      code: Code.fromInline(
        "exports.handler = async (event) => console.log(event)",
      ),
      runtime: Runtime.NODEJS_LATEST,
      handler: "index.handler",
    });
  }
}
