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

  /**
   * Marks Stage 1 (Application Window) as completed and starts Stage 2.
   */
  completeApplicationWindow(
    timeline?: CampaignTimeline,
    endedDate: Date = new Date(),
  ): CampaignTimeline {
    const current = timeline || this.initCampaignTimeline(endedDate);
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
    const current = timeline || this.initCampaignTimeline(endedDate);
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
   * Extends stage SLA deadline by +3 days for dispute resolution 'extend_days'.
   */
  extendDays(timeline?: ApplicationTimeline, additionalDays: number = 3): ApplicationTimeline {
    const current = timeline || this.initCreatorApplicationTimeline();

    // Find current active/in_progress or disputed stage to extend
    const keys: (keyof ApplicationTimeline)[] = [
      'stage3_content_creation',
      'stage4_content_review',
      'stage5_revised_creation',
      'stage6_revised_review',
    ];

    for (const key of keys) {
      const stage = current[key];
      if (stage && (stage.status === 'in_progress' || stage.status === 'disputed')) {
        stage.status = 'extended';
        stage.extendedDays = (stage.extendedDays || 0) + additionalDays;

        const baseDate = stage.endedDate ? new Date(stage.endedDate) : new Date();
        stage.endedDate = new Date(
          baseDate.getTime() + additionalDays * 24 * 60 * 60 * 1000,
        ).toISOString();
        break;
      }
    }

    return current;
  }
}
