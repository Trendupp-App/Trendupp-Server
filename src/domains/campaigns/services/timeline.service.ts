import { Injectable } from '@nestjs/common';

export interface StageTimelineItem {
  goal: string;
  status: 'pending' | 'in_progress' | 'completed' | 'skipped' | 'disputed' | 'extended';
  startedDate: string | null;
  endedDate: string | null;
  intendedFor: string | null;
  extendedDays?: number;
}

export type CampaignTimeline = Record<string, StageTimelineItem>;
export type ApplicationTimeline = Record<string, StageTimelineItem>;

@Injectable()
export class TimelineService {
  /**
   * Initializes Campaign-level timeline (Stages 0, 1, and 2).
   */
  initCampaignTimeline(approvedAt: Date = new Date()): CampaignTimeline {
    const startIso = approvedAt.toISOString();
    const endWindowIso = new Date(approvedAt.getTime() + 48 * 60 * 60 * 1000).toISOString();

    return {
      stage0_escrow: {
        goal: 'Campaign setup & escrow funding',
        status: 'completed',
        startedDate: startIso,
        endedDate: startIso,
        intendedFor: 'Before go-live',
      },
      stage1_application_window: {
        goal: 'Application window (Creators apply)',
        status: 'in_progress',
        startedDate: startIso,
        endedDate: endWindowIso,
        intendedFor: '48 hours',
      },
      stage2_application_review: {
        goal: 'Brand application review & creator selection',
        status: 'pending',
        startedDate: null,
        endedDate: null,
        intendedFor: null,
      },
    };
  }

  private normalizeTimeline(timeline?: unknown, fallbackDate: Date = new Date()): CampaignTimeline {
    if (!timeline) {
      return this.initCampaignTimeline(fallbackDate);
    }
    if (typeof timeline === 'string') {
      try {
        const parsed = JSON.parse(timeline) as unknown;
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          return parsed as CampaignTimeline;
        }
      } catch {
        // legacy date string or invalid JSON
      }
      return this.initCampaignTimeline(fallbackDate);
    }
    if (typeof timeline === 'object' && !Array.isArray(timeline)) {
      return { ...(timeline as CampaignTimeline) };
    }
    return this.initCampaignTimeline(fallbackDate);
  }

  /**
   * Marks Stage 1 (Application Window) as completed and starts Stage 2.
   */
  completeApplicationWindow(
    timeline?: CampaignTimeline,
    endedDate: Date = new Date(),
  ): CampaignTimeline {
    const current = this.normalizeTimeline(timeline, endedDate);
    const endedIso = endedDate.toISOString();

    current.stage1_application_window = {
      ...current.stage1_application_window,
      status: 'completed',
      endedDate: endedIso,
    };

    current.stage2_application_review = {
      ...current.stage2_application_review,
      status: 'in_progress',
      startedDate: endedIso,
    };

    return current;
  }

  /**
   * Marks Stage 2 (Application Review) as completed when brand accepts applicants.
   */
  completeApplicationReview(
    timeline?: CampaignTimeline,
    endedDate: Date = new Date(),
  ): CampaignTimeline {
    const current = this.normalizeTimeline(timeline, endedDate);
    const endedIso = endedDate.toISOString();

    if (current.stage2_application_review) {
      current.stage2_application_review = {
        ...current.stage2_application_review,
        status: 'completed',
        endedDate: endedIso,
      };
    }

    return current;
  }

  /**
   * Initializes Application-level timeline for creator (Stages 3 to 10).
   * For Amplification campaigns ('Amplify Content'), Stages 3–6 are marked as 'skipped'.
   */
  initCreatorApplicationTimeline(
    campaignGoal: string = 'Create Content',
    selectionDate: Date = new Date(),
  ): ApplicationTimeline {
    const isAmplification = campaignGoal === 'Amplify Content' || campaignGoal === 'Amplification';
    const selIso = selectionDate.toISOString();

    if (isAmplification) {
      return {
        stage3_content_creation: {
          goal: 'Content creation & submission (Draft)',
          status: 'skipped',
          startedDate: null,
          endedDate: null,
          intendedFor: null,
        },
        stage4_content_review: {
          goal: 'Content review (Draft)',
          status: 'skipped',
          startedDate: null,
          endedDate: null,
          intendedFor: null,
        },
        stage5_revised_creation: {
          goal: 'Revised content creation & submission',
          status: 'skipped',
          startedDate: null,
          endedDate: null,
          intendedFor: null,
        },
        stage6_revised_review: {
          goal: 'Revised content review',
          status: 'skipped',
          startedDate: null,
          endedDate: null,
          intendedFor: null,
        },
        stage7_live_submission: {
          goal: 'Live content submission',
          status: 'in_progress',
          startedDate: selIso,
          endedDate: null,
          intendedFor: null,
        },
        stage8_live_review: {
          goal: 'Live link review (Brand)',
          status: 'pending',
          startedDate: null,
          endedDate: null,
          intendedFor: null,
        },
        stage10_payment_release: {
          goal: 'Payment release (30 days payout)',
          status: 'pending',
          startedDate: null,
          endedDate: null,
          intendedFor: '30 days',
        },
      };
    }

    // Default 'Create Content' SLA (5 days for draft creation)
    const draftTargetDate = new Date(
      selectionDate.getTime() + 5 * 24 * 60 * 60 * 1000,
    ).toISOString();

    return {
      stage3_content_creation: {
        goal: 'Content creation & submission (Draft)',
        status: 'in_progress',
        startedDate: selIso,
        endedDate: draftTargetDate,
        intendedFor: '3–5 days',
        extendedDays: 0,
      },
      stage4_content_review: {
        goal: 'Content review (Draft)',
        status: 'pending',
        startedDate: null,
        endedDate: null,
        intendedFor: '48 hours',
        extendedDays: 0,
      },
      stage5_revised_creation: {
        goal: 'Revised content creation & submission',
        status: 'pending',
        startedDate: null,
        endedDate: null,
        intendedFor: '2–3 days',
        extendedDays: 0,
      },
      stage6_revised_review: {
        goal: 'Revised content review',
        status: 'pending',
        startedDate: null,
        endedDate: null,
        intendedFor: '48 hours',
        extendedDays: 0,
      },
      stage7_live_submission: {
        goal: 'Live content submission',
        status: 'pending',
        startedDate: null,
        endedDate: null,
        intendedFor: null,
      },
      stage8_live_review: {
        goal: 'Live link review (Brand)',
        status: 'pending',
        startedDate: null,
        endedDate: null,
        intendedFor: null,
      },
      stage10_payment_release: {
        goal: 'Payment release (30 days payout)',
        status: 'pending',
        startedDate: null,
        endedDate: null,
        intendedFor: '30 days',
      },
    };
  }

  /**
   * Updates Application timeline when creator submits draft.
   */
  recordDraftSubmission(
    timeline?: ApplicationTimeline,
    submissionDate: Date = new Date(),
  ): ApplicationTimeline {
    const current = timeline || this.initCreatorApplicationTimeline();
    const subIso = submissionDate.toISOString();
    const reviewTargetIso = new Date(submissionDate.getTime() + 48 * 60 * 60 * 1000).toISOString();

    if (current.stage3_content_creation && current.stage3_content_creation.status !== 'skipped') {
      current.stage3_content_creation.status = 'completed';
      current.stage3_content_creation.endedDate = subIso;
    }

    if (current.stage4_content_review && current.stage4_content_review.status !== 'skipped') {
      current.stage4_content_review.status = 'in_progress';
      current.stage4_content_review.startedDate = subIso;
      current.stage4_content_review.endedDate = reviewTargetIso;
    }

    return current;
  }

  /**
   * Updates Application timeline when creator submits revised draft.
   */
  recordRevisedDraftSubmission(
    timeline?: ApplicationTimeline,
    submissionDate: Date = new Date(),
  ): ApplicationTimeline {
    const current = timeline || this.initCreatorApplicationTimeline();
    const subIso = submissionDate.toISOString();
    const reviewTargetIso = new Date(submissionDate.getTime() + 48 * 60 * 60 * 1000).toISOString();

    if (current.stage5_revised_creation && current.stage5_revised_creation.status !== 'skipped') {
      current.stage5_revised_creation.status = 'completed';
      current.stage5_revised_creation.endedDate = subIso;
    }

    if (current.stage6_revised_review && current.stage6_revised_review.status !== 'skipped') {
      current.stage6_revised_review.status = 'in_progress';
      current.stage6_revised_review.startedDate = subIso;
      current.stage6_revised_review.endedDate = reviewTargetIso;
    }

    return current;
  }

  /**
   * Updates Application timeline when brand vets draft (approved, request_revision, or rejected).
   */
  recordDraftVetting(
    timeline: ApplicationTimeline | undefined,
    decision: 'approved' | 'request_revision' | 'rejected',
    vettingDate: Date = new Date(),
  ): ApplicationTimeline {
    const current = timeline || this.initCreatorApplicationTimeline();
    const vetIso = vettingDate.toISOString();

    if (decision === 'approved') {
      if (current.stage4_content_review && current.stage4_content_review.status !== 'skipped') {
        current.stage4_content_review.status = 'completed';
        current.stage4_content_review.endedDate = vetIso;
      }
      if (current.stage6_revised_review && current.stage6_revised_review.status === 'in_progress') {
        current.stage6_revised_review.status = 'completed';
        current.stage6_revised_review.endedDate = vetIso;
      }
      if (current.stage7_live_submission) {
        current.stage7_live_submission.status = 'in_progress';
        current.stage7_live_submission.startedDate = vetIso;
      }
    } else if (decision === 'request_revision') {
      if (current.stage4_content_review && current.stage4_content_review.status !== 'skipped') {
        current.stage4_content_review.status = 'completed';
        current.stage4_content_review.endedDate = vetIso;
      }
      const revisionTargetIso = new Date(
        vettingDate.getTime() + 3 * 24 * 60 * 60 * 1000,
      ).toISOString();
      if (current.stage5_revised_creation) {
        current.stage5_revised_creation.status = 'in_progress';
        current.stage5_revised_creation.startedDate = vetIso;
        current.stage5_revised_creation.endedDate = revisionTargetIso;
      }
    } else if (decision === 'rejected') {
      if (current.stage4_content_review && current.stage4_content_review.status === 'in_progress') {
        current.stage4_content_review.status = 'disputed';
        current.stage4_content_review.endedDate = vetIso;
      }
      if (current.stage6_revised_review && current.stage6_revised_review.status === 'in_progress') {
        current.stage6_revised_review.status = 'disputed';
        current.stage6_revised_review.endedDate = vetIso;
      }
    }

    return current;
  }

  /**
   * Updates Application timeline when creator submits live link.
   */
  recordLivePostSubmission(
    timeline?: ApplicationTimeline,
    submissionDate: Date = new Date(),
  ): ApplicationTimeline {
    const current = timeline || this.initCreatorApplicationTimeline();
    const subIso = submissionDate.toISOString();

    if (current.stage7_live_submission) {
      current.stage7_live_submission.status = 'completed';
      current.stage7_live_submission.endedDate = subIso;
    }

    if (current.stage8_live_review) {
      current.stage8_live_review.status = 'in_progress';
      current.stage8_live_review.startedDate = subIso;
    }

    return current;
  }

  /**
   * Updates Application timeline when brand approves live link.
   */
  recordLivePostApproval(
    timeline?: ApplicationTimeline,
    approvalDate: Date = new Date(),
    releaseDate: Date = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  ): ApplicationTimeline {
    const current = timeline || this.initCreatorApplicationTimeline();
    const appIso = approvalDate.toISOString();
    const relIso = releaseDate.toISOString();

    if (current.stage8_live_review) {
      current.stage8_live_review.status = 'completed';
      current.stage8_live_review.endedDate = appIso;
    }

    if (current.stage10_payment_release) {
      current.stage10_payment_release.status = 'in_progress';
      current.stage10_payment_release.startedDate = appIso;
      current.stage10_payment_release.endedDate = relIso;
    }

    return current;
  }

  /**
   * Extends Stage 3 (Creator draft submission) deadline by +3 days.
   * Used when admin selects "Allow Content Submission" on a dispute.
   */
  extendContentSubmission(
    timeline?: ApplicationTimeline,
    additionalDays: number = 3,
  ): ApplicationTimeline {
    return this.extendSpecificStage(timeline, 'stage3_content_creation', additionalDays);
  }

  /**
   * Extends Stage 4 (Brand draft review) deadline by +3 days.
   * Used when admin selects "Allow Content Review" on a dispute.
   */
  extendContentReview(
    timeline?: ApplicationTimeline,
    additionalDays: number = 3,
  ): ApplicationTimeline {
    return this.extendSpecificStage(timeline, 'stage4_content_review', additionalDays);
  }

  /**
   * Extends Stage 5 (Creator revised submission) deadline by +3 days.
   * Used when admin selects "Allow Revised Submission" on a dispute.
   */
  extendRevisedSubmission(
    timeline?: ApplicationTimeline,
    additionalDays: number = 3,
  ): ApplicationTimeline {
    return this.extendSpecificStage(timeline, 'stage5_revised_creation', additionalDays);
  }

  /**
   * Extends Stage 6 (Brand revised review) deadline by +3 days.
   * Used when admin selects "Allow Revised Review" on a dispute.
   */
  extendRevisedReview(
    timeline?: ApplicationTimeline,
    additionalDays: number = 3,
  ): ApplicationTimeline {
    return this.extendSpecificStage(timeline, 'stage6_revised_review', additionalDays);
  }

  /**
   * Extends a specific named stage deadline.
   * Sets the stage status to 'extended', bumps extendedDays, and pushes endedDate forward.
   */
  private extendSpecificStage(
    timeline: ApplicationTimeline | undefined,
    stageKey: string,
    additionalDays: number,
  ): ApplicationTimeline {
    const current = timeline || this.initCreatorApplicationTimeline();
    const stage = current[stageKey];

    if (stage && stage.status !== 'skipped') {
      stage.status = 'extended';
      stage.extendedDays = (stage.extendedDays || 0) + additionalDays;
      const baseDate = stage.endedDate ? new Date(stage.endedDate) : new Date();
      stage.endedDate = new Date(
        baseDate.getTime() + additionalDays * 24 * 60 * 60 * 1000,
      ).toISOString();
    }

    return current;
  }

  /**
   * Formats individual application timeline for a creator with SLA duration and overdue status labels.
   */
  formatCreatorTimeline(
    application: {
      id: string;
      creatorId: string;
      creator?: { firstName?: string; lastName?: string; username?: string; avatarUrl?: string };
      timeline?: ApplicationTimeline | null;
      status?: string;
    },
    campaignGoal: string = 'Create Content',
  ): FormattedCreatorTimeline {
    const rawTimeline = application.timeline || this.initCreatorApplicationTimeline(campaignGoal);
    const creatorName = application.creator
      ? `${application.creator.firstName || ''} ${application.creator.lastName || ''}`.trim() ||
        application.creator.username ||
        'Creator'
      : 'Creator';
    const avatarUrl = application.creator?.avatarUrl || null;

    let overdueCount = 0;
    const stages: Record<string, FormattedCreatorStage> = {};
    const now = new Date();

    for (const [key, stage] of Object.entries(rawTimeline)) {
      let statusLabel: FormattedCreatorStage['statusLabel'] = 'Not started';
      let durationText = 'Not started';

      if (stage.status === 'skipped') {
        statusLabel = 'Skipped';
        durationText = 'N/A';
      } else if (stage.status === 'completed') {
        if (stage.startedDate && stage.endedDate) {
          const diffMs =
            new Date(stage.endedDate).getTime() - new Date(stage.startedDate).getTime();
          const days = Math.round((diffMs / (1000 * 60 * 60 * 24)) * 10) / 10;
          durationText = days === 1 ? '1 day' : `${days} days`;
        } else {
          durationText = 'Completed';
        }

        const isDelayed = stage.endedDate && stage.intendedFor && this.isStageDelayed(stage);
        if (isDelayed) {
          statusLabel = 'Delayed';
          overdueCount++;
        } else {
          statusLabel = 'On time';
        }
      } else if (stage.status === 'in_progress' || stage.status === 'extended') {
        if (stage.startedDate) {
          const diffMs = now.getTime() - new Date(stage.startedDate).getTime();
          const hours = Math.floor(diffMs / (1000 * 60 * 60));
          durationText = hours < 24 ? `${hours}h so far` : `${Math.floor(hours / 24)}d so far`;
        } else {
          durationText = 'In progress';
        }

        if (stage.endedDate && now > new Date(stage.endedDate)) {
          statusLabel = 'Delayed';
          overdueCount++;
        } else {
          statusLabel = stage.status === 'extended' ? 'Extended' : 'In progress';
        }
      } else if (stage.status === 'disputed') {
        statusLabel = 'Disputed';
        durationText = 'Disputed';
      }

      stages[key] = {
        stageKey: key,
        goal: stage.goal,
        status: stage.status,
        statusLabel,
        intendedFor: stage.intendedFor,
        durationText,
        startedDate: stage.startedDate,
        endedDate: stage.endedDate,
        extendedDays: stage.extendedDays,
      };
    }

    const summaryStatus =
      overdueCount > 0
        ? `${overdueCount} stage${overdueCount > 1 ? 's' : ''} over the expected time`
        : 'On time';

    return {
      applicationId: application.id,
      creatorId: application.creatorId,
      creatorName,
      avatarUrl,
      summaryStatus,
      stages,
    };
  }

  /**
   * Formats creators_timeline array for all accepted/selected applicants of a campaign.
   */
  formatCreatorsTimeline(
    applications: {
      id: string;
      creatorId: string;
      creator?: { firstName?: string; lastName?: string; username?: string; avatarUrl?: string };
      timeline?: ApplicationTimeline | null;
      status?: string;
    }[],
    campaignGoal: string = 'Create Content',
  ): FormattedCreatorTimeline[] {
    const accepted = (applications || []).filter(
      (app) => app.status === 'accepted' || app.status === 'approved' || app.status === 'selected',
    );
    return accepted.map((app) => this.formatCreatorTimeline(app, campaignGoal));
  }

  private isStageDelayed(stage: StageTimelineItem): boolean {
    if (!stage.startedDate || !stage.endedDate) return false;
    const actualDurationHours =
      (new Date(stage.endedDate).getTime() - new Date(stage.startedDate).getTime()) /
      (1000 * 60 * 60);

    let maxExpectedHours = 120;
    if (stage.intendedFor) {
      if (stage.intendedFor.includes('48 hours')) {
        maxExpectedHours = 48;
      } else if (stage.intendedFor.includes('2–3 days') || stage.intendedFor.includes('2-3 days')) {
        maxExpectedHours = 72;
      } else if (stage.intendedFor.includes('3–5 days') || stage.intendedFor.includes('3-5 days')) {
        maxExpectedHours = 120;
      } else if (stage.intendedFor.includes('30 days')) {
        maxExpectedHours = 720;
      }
    }
    maxExpectedHours += (stage.extendedDays || 0) * 24;

    return actualDurationHours > maxExpectedHours;
  }
}

export interface FormattedCreatorStage {
  stageKey: string;
  goal: string;
  status: string;
  statusLabel:
    | 'On time'
    | 'Delayed'
    | 'In progress'
    | 'Not started'
    | 'Skipped'
    | 'Disputed'
    | 'Extended';
  intendedFor: string | null;
  durationText: string;
  startedDate: string | null;
  endedDate: string | null;
  extendedDays?: number;
}

export interface FormattedCreatorTimeline {
  applicationId: string;
  creatorId: string;
  creatorName: string;
  avatarUrl: string | null;
  summaryStatus: string;
  stages: Record<string, FormattedCreatorStage>;
}
