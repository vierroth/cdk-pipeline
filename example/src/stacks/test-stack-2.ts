import { Stack, StackProps } from "aws-cdk-lib";
import { Code, Runtime } from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Construct } from "constructs";

export interface TestStack2Props extends StackProps {}

export class TestStack2 extends Stack {
  constructor(scope: Construct, id: string, props: TestStack2Props) {
    super(scope, id, props);

    new NodejsFunction(this, "TestLambda2", {
      code: Code.fromInline(
        "exports.handler = async (event) => console.log(event)",
      ),
      runtime: Runtime.NODEJS_LATEST,
      handler: "index.handler",
    });
  }
}
