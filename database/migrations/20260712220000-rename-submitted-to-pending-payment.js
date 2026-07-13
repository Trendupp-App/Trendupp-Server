'use strict';

/**
 * @type {import('sequelize-cli').Migration}
 *
 * Renames the informal `submitted` campaign status to the more semantically
 * accurate `pending_payment`. The `submitted` status was previously set as
 * soon as a brand clicked "submit", before any payment was confirmed. This
 * caused a dead-end where payment failures left the campaign permanently
 * blocked in a non-retryable state.
 *
 * New lifecycle:
 *   draft → pending_payment → live → active → completed | cancelled
 *
 * Brands can now re-hit the submit endpoint while status is `pending_payment`
 * and paymentStatus is `pending` to obtain a fresh Pandascrow checkout URL.
 */
module.exports = {
  async up(queryInterface) {
    // Rename any campaigns stuck in the old 'submitted' status
    await queryInterface.sequelize.query(`
      UPDATE campaigns
      SET status = 'pending_payment'
      WHERE status = 'submitted';
    `);
  },

  async down(queryInterface) {
    // Rollback: revert pending_payment (unpaid) campaigns back to submitted
    await queryInterface.sequelize.query(`
      UPDATE campaigns
      SET status = 'submitted'
      WHERE status = 'pending_payment'
        AND payment_status = 'pending';
    `);
  },
};
