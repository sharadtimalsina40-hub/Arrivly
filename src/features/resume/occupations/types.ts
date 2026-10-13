import type { OccupationProfileId } from '../model/types';

export interface OccupationQuestionOption {
  readonly value: string;
  readonly label: string;
}

interface OccupationQuestionBase<
  ProfileId extends OccupationProfileId = OccupationProfileId,
> {
  readonly id: string;
  readonly profileId: ProfileId;
  readonly label: string;
  readonly helpText?: string;
}

export interface BooleanOccupationQuestion<
  ProfileId extends OccupationProfileId = OccupationProfileId,
> extends OccupationQuestionBase<ProfileId> {
  readonly type: 'boolean';
}

export interface TextOccupationQuestion<
  ProfileId extends OccupationProfileId = OccupationProfileId,
> extends OccupationQuestionBase<ProfileId> {
  readonly type: 'text';
  readonly placeholder?: string;
  readonly multiline?: boolean;
}

export interface SingleSelectOccupationQuestion<
  ProfileId extends OccupationProfileId = OccupationProfileId,
> extends OccupationQuestionBase<ProfileId> {
  readonly type: 'single-select';
  readonly options: readonly OccupationQuestionOption[];
}

export interface MultiSelectOccupationQuestion<
  ProfileId extends OccupationProfileId = OccupationProfileId,
> extends OccupationQuestionBase<ProfileId> {
  readonly type: 'multi-select';
  readonly options: readonly OccupationQuestionOption[];
}

export type OccupationQuestionDefinition<
  ProfileId extends OccupationProfileId = OccupationProfileId,
> =
  | BooleanOccupationQuestion<ProfileId>
  | TextOccupationQuestion<ProfileId>
  | SingleSelectOccupationQuestion<ProfileId>
  | MultiSelectOccupationQuestion<ProfileId>;

export interface OccupationQuestionGroup<
  ProfileId extends OccupationProfileId = OccupationProfileId,
> {
  readonly id: string;
  readonly title: string;
  readonly description?: string;
  readonly questions: readonly OccupationQuestionDefinition<ProfileId>[];
}

export interface OccupationProfile<
  ProfileId extends OccupationProfileId = OccupationProfileId,
> {
  readonly id: ProfileId;
  readonly label: string;
  readonly description: string;
  readonly groups: readonly OccupationQuestionGroup<ProfileId>[];
}
