import { IAction } from "aws-cdk-lib/aws-codepipeline";
import { CodeStarConnectionsSourceAction } from "aws-cdk-lib/aws-codepipeline-actions";

import { Pipeline } from "./pipeline";
import { Artifact } from "./artifact";
import { SegmentConstructed } from "./segment";
import { SourceSegment, SourceSegmentProps } from "./source-segment";

export interface CodeStarSourceSegmentProps extends SourceSegmentProps {
  readonly owner: string;
  readonly connectionArn: string;
  readonly repository: string;
  readonly branch?: string;
  readonly triggerOnPush?: boolean;
  readonly variablesNamespace?: string;
}

/**
 * @category Segments
 */
export class CodeStarSourceSegment extends SourceSegment {
  private props: CodeStarSourceSegmentProps;
  constructor(props: CodeStarSourceSegmentProps) {
    super(props);
    this.props = props;
  }
  construct(scope: Pipeline): SegmentConstructed {
    return new CodeStarSourceSegmentConstructed(scope, this.props.repository, {
      ...this.props,
      actionName: this.props.repository,
      repo: this.props.repository,
    });
  }
}

export interface CodeStarSourceSegmentConstructedProps {
  readonly output: Artifact;
  readonly actionName: string;
  readonly connectionArn: string;
  readonly owner: string;
  readonly repo: string;
  readonly branch?: string;
  readonly runOrder?: number;
  readonly triggerOnPush?: boolean;
  readonly variablesNamespace?: string;
}

export class CodeStarSourceSegmentConstructed extends SegmentConstructed {
  readonly name: string;
  readonly actions: IAction[];
  constructor(
    scope: Pipeline,
    id: string,
    props: CodeStarSourceSegmentConstructedProps,
  ) {
    super(scope, id);
    this.name = "Source";
    this.actions = [new CodeStarConnectionsSourceAction(props)];
  }
}
