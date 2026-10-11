/** Trạng thái vòng đời của một ExhibitRevision (xem 04-data-model-erd.md). */
export enum RevisionStatus {
  DRAFT = 'draft',
  PENDING = 'pending',
  PUBLISHED = 'published',
  REJECTED = 'rejected',
  ARCHIVED = 'archived',
  HIDDEN = 'hidden',
}
