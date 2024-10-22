import { Artifact as AwsArtifact } from "aws-cdk-lib/aws-codepipeline";

import { Segment } from "./segment";

export class Artifact extends AwsArtifact {
  private producer?: Segment;
  private consumers: Segment[] = [];
  constructor(artifactName?: string) {
    super(artifactName);
  }
  produce(producer: Segment) {
    if (this.producer) throw new Error("Artifact is already produced");
    this.producer = producer;
  }
  consume(producer: Segment) {
    this.consumers.push(producer);
  }
  obtainProducer(): Segment | undefined {
    return this.producer;
  }
  obtainConsumers(): Segment[] {
    return this.consumers;
  }
}
