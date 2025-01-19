import { IAction } from "aws-cdk-lib/aws-codepipeline";
import {
  CodeCommitSourceAction,
  CodeCommitTrigger,
} from "aws-cdk-lib/aws-codepipeline-actions";
import { IRepository } from "aws-cdk-lib/aws-codecommit";

import { Pipeline } from "./pipeline";
import { Artifact } from "./artifact";
import { SegmentConstructed } from "./segment";
import { SourceSegment, SourceSegmentProps } from "./source-segment";

export interface CodeCommitSourceSegmentProps extends SourceSegmentProps {
  readonly repository: IRepository;
  readonly branch?: string;
  readonly trigger?: CodeCommitTrigger;
  readonly variablesNamespace?: string;
}

/**
 * @category Segments
 */
export class CodeCommitSourceSegment extends SourceSegment {
  private props: CodeCommitSourceSegmentProps;
  constructor(props: CodeCommitSourceSegmentProps) {
    super(props);
    this.props = props;
  }
  construct(scope: Pipeline): SegmentConstructed {
    const name = `${this.props.repository}-${this.props.branch || "master"}`;

    return new CodeCommitSourceSegmentConstructed(scope, name, {
      ...this.props,
      actionName: name,
    });
  }
}

export interface CodeCommitSourceSegmentConstructedProps {
  readonly output: Artifact;
  readonly actionName: string;
  readonly repository: IRepository;
  readonly branch?: string;
  readonly trigger?: CodeCommitTrigger;
  readonly variablesNamespace?: string;
}

export class CodeCommitSourceSegmentConstructed extends SegmentConstructed {
  readonly name: string;
  readonly actions: IAction[];
  constructor(
    scope: Pipeline,
    id: string,
    props: CodeCommitSourceSegmentConstructedProps,
  ) {
    super(scope, id);
    this.name = "Source";
    this.actions = [new CodeCommitSourceAction(props)];
  }
}
