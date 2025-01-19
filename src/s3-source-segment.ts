import { IAction } from "aws-cdk-lib/aws-codepipeline";
import {
  S3SourceAction,
  S3Trigger,
} from "aws-cdk-lib/aws-codepipeline-actions";
import { SecretValue } from "aws-cdk-lib";
import { IBucket } from "aws-cdk-lib/aws-s3";

import { Pipeline } from "./pipeline";
import { Artifact } from "./artifact";
import { SegmentConstructed } from "./segment";
import { SourceSegment, SourceSegmentProps } from "./source-segment";

export interface S3SourceSegmentProps extends SourceSegmentProps {
  readonly oauthToken: SecretValue;
  readonly bucket: IBucket;
  readonly bucketKey: string;
  readonly trigger?: S3Trigger;
  readonly variablesNamespace?: string;
}

/**
 * @category Segments
 */
export class S3SourceSegment extends SourceSegment {
  private props: S3SourceSegmentProps;
  constructor(props: S3SourceSegmentProps) {
    super(props);
    this.props = props;
  }
  construct(scope: Pipeline): SegmentConstructed {
    const name = `${this.props.bucket}-${this.props.bucketKey}`;

    return new S3SourceSegmentConstructed(scope, name, {
      ...this.props,
      actionName: name,
    });
  }
}

export interface S3SourceSegmentConstructedProps {
  readonly output: Artifact;
  readonly actionName: string;
  readonly bucket: IBucket;
  readonly bucketKey: string;
  readonly trigger?: S3Trigger;
  readonly variablesNamespace?: string;
}

export class S3SourceSegmentConstructed extends SegmentConstructed {
  readonly name: string;
  readonly actions: IAction[];
  constructor(
    scope: Pipeline,
    id: string,
    props: S3SourceSegmentConstructedProps,
  ) {
    super(scope, id);
    this.name = "Source";
    this.actions = [new S3SourceAction(props)];
  }
}
