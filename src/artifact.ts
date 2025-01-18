import { Artifact as AwsArtifact } from "aws-cdk-lib/aws-codepipeline";

import { Segment } from "./segment";

export class Artifact extends AwsArtifact {
  private _producer?: Segment;
  private _consumers: Segment[] = [];
  constructor(artifactName?: string) {
    super(artifactName);
  }
  produce(producer: Segment) {
    if (this._producer) throw new Error("Artifact is already produced");
    this._producer = producer;
  }
  consume(producer: Segment) {
    this.consumers.push(producer);
  }
  get producer(): Segment | undefined {
    return this._producer;
  }
  get consumers(): Segment[] {
    return this._consumers;
  }
}
