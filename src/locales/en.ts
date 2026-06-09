export interface Locale {
  panel: {
    title: string;
    description: string;
    languagePrompt: string;
    languagePlaceholder: string;
    selectType: string;
    typePlaceholder: string;
  };
  ticketTypes: {
    middleman: { label: string; description: string };
    tickets: { label: string; description: string };
  };
  ticket: {
    created: (channelId: string) => string;
    alreadyOpen: (type: string, channelId: string) => string;
    cooldown: (type: string, ts: number) => string;
    maxOpen: (max: number) => string;
    notConfigured: string;
    blocked: string;
    noForm: string;
    createFailed: string;
    saveFailed: string;
    welcome: string;
    openedBy: string;
    claimed: string;
    closed: string;
    reopened: string;
    escalated: string;
    noteAdded: string;
    ticketNotFound: string;
    noPermClose: string;
    noPermClaim: string;
    noPermReopen: string;
    noPermEscalate: string;
    noPermMove: string;
    noPermDelete: string;
    noPermNote: string;
    noPermFunds: string;
    unknownAction: string;
    deletionCancelled: string;
    moveNoCategories: string;
    moveNoOther: string;
    moveFailed: string;
    movePlaceholder: string;
    moveSelectPrompt: string;
    moveSuccess: string;
    moveDestination: string;
    expiredMiddleman: string;
    creatingMiddleman: string;
    bankNameRequired: string;
  };
  close: {
    title: string;
    description: string;
    closedBy: string;
    closedAt: string;
    reason: string;
    noReason: string;
    footerPrefix: string;
    reopen: string;
    move: string;
    delete: string;
  };
  delete: {
    confirmTitle: string;
    confirmDescription: string;
    confirmButton: string;
    cancelButton: string;
    deleted: string;
    logTitle: string;
    logTicket: string;
    logDeletedBy: string;
    logDeletedAt: string;
    logTranscript: string;
    logTranscriptAttached: string;
    logTranscriptFailed: string;
  };
  ticketEmbed: {
    createdBy: string;
    status: string;
    priority: string;
    details: string;
    claim: string;
    close: string;
    addNote: string;
    noteModalTitle: string;
    noteLabel: string;
  };
  middleman: {
    paymentTitle: string;
    paymentInfo: (bankName: string, accountNumber: string, accountHolder: string) => string;
    paymentInstructions: string;
    paymentInstructionText: (amount: string) => string;
    selectPaymentTitle: string;
    selectPaymentDescription: string;
    feeNone: string;
    feeGopay: string;
    feeOtherBank: string;
    feeFooter: string;
    bankModalTitle: string;
    bankLabel: string;
    bankPlaceholder: string;
    summaryTitle: string;
    summaryText: (itemPrice: string, mmFee: string, payFee: string, payMethod: string, total: string) => string;
    participants: string;
    creator: string;
    buyer: string;
    seller: string;
    buyerNotFound: (input: string) => string;
    sellerNotFound: (input: string) => string;
    itemPrice: string;
    mmFee: string;
    paymentFee: string;
    paymentMethod: string;
    feeResponsibility: string;
    transactionId: string;
    buyerPays: string;
    sellerReceives: string;
    status: string;
    awaitingPayment: string;
    fundsReceived: string;
    fundsReceivedBy: string;
    fundsReceivedAt: string;
    fundsButton: string;
    fundsConfirmed: (userId: string) => string;
    summaryFooter: string;
    warningTitle: string;
    warningAction: string;
    warningActionStaff: (roleId: string) => string;
    warningActionNoRole: string;
    feeLabels: { buyer: string; seller: string; split: string };
    validationBothRequired: string;
    validationAmountRequired: string;
    validationAmountInvalid: string;
    validationFeeRequired: string;
    validationFeeInvalid: (raw: string) => string;
    validationSameUser: string;
  };
  notification: {
    closedTitle: string;
    closedDescription: (num: number, type: string, reason: string, guildName: string) => string;
    transactionTitle: string;
    transactionDescription: (humanId: string, status: string, item: string) => string;
    noReason: string;
  };
  modal: {
    supportTitle: string;
    subject: string;
    subjectPlaceholder: string;
    description: string;
    descriptionPlaceholder: string;
    attempted: string;
    attemptedPlaceholder: string;
  };
}

export const en: Locale = {
  panel: {
    title: 'Create a Ticket',
    description: 'Need help or want to start a secure trade?\n\nSelect a ticket type below to get started.',
    languagePrompt: 'Language / Bahasa',
    languagePlaceholder: 'Select your language...',
    selectType: 'What can we help you with?',
    typePlaceholder: 'Choose a ticket type...',
  },
  ticketTypes: {
    middleman: {
      label: 'Middleman',
      description: 'Create a secure middleman transaction.',
    },
    tickets: {
      label: 'Support',
      description: 'Contact staff for assistance.',
    },
  },
  ticket: {
    created: (channelId) => `✅ Ticket created — <#${channelId}>`,
    alreadyOpen: (type, channelId) => `You already have an open ${type} ticket. Go to your existing ticket: <#${channelId}>`,
    cooldown: (type, ts) => `You are on cooldown. You can open another ${type} ticket <t:${ts}:R>.`,
    maxOpen: (max) => `You have reached the maximum of ${max} open tickets.`,
    notConfigured: 'Bot is not configured for this server. An admin must run `/setup` first.',
    blocked: 'You are not allowed to open tickets at this time. Contact an administrator if you believe this is a mistake.',
    noForm: 'This ticket type has no form configured.',
    createFailed: 'Failed to create ticket channel. Please contact an administrator — the bot may be missing `Manage Channels` permission in the ticket category.',
    saveFailed: 'Failed to save ticket. Please try again.',
    welcome: 'Please describe your issue in detail. A staff member will assist you shortly.',
    openedBy: 'Opened by',
    claimed: 'You have claimed this ticket.',
    closed: 'Ticket closed.',
    reopened: '🔓 Ticket reopened.',
    escalated: 'Ticket escalated.',
    noteAdded: 'Note added.',
    ticketNotFound: 'Ticket not found.',
    noPermClose: '❌ You do not have permission to close this ticket.',
    noPermClaim: '❌ Only staff can claim tickets.',
    noPermReopen: '❌ Only staff can reopen tickets.',
    noPermEscalate: '❌ Only staff can escalate tickets.',
    noPermMove: '❌ Only staff can move tickets.',
    noPermDelete: '❌ Only admins can delete tickets.',
    noPermNote: '❌ Only staff can add notes.',
    noPermFunds: '❌ Only staff can confirm funds received.',
    unknownAction: 'Unknown action.',
    deletionCancelled: 'Deletion cancelled.',
    moveNoCategories: 'No categories found in this server.',
    moveNoOther: 'No other categories to move this ticket to.',
    moveFailed: 'Failed to move ticket. Check bot permissions.',
    movePlaceholder: 'Select destination category...',
    moveSelectPrompt: '📂 Select a destination category:',
    moveSuccess: '✅ Ticket Moved',
    moveDestination: 'Destination',
    expiredMiddleman: '⏰ Your middleman request expired. Please open a new ticket from the panel.',
    creatingMiddleman: '⏳ Creating your middleman ticket...',
    bankNameRequired: '❌ Bank name is required when "Other Bank" is selected.',
  },
  close: {
    title: '🔒 Ticket Closed',
    description: 'This ticket has been closed. Use the buttons below to manage it.',
    closedBy: 'Closed By',
    closedAt: 'Closed At',
    reason: 'Reason',
    noReason: 'No reason provided',
    footerPrefix: 'Ticket ID: ',
    reopen: 'Reopen',
    move: 'Move Ticket',
    delete: 'Delete Ticket',
  },
  delete: {
    confirmTitle: '⚠️ Are you sure?',
    confirmDescription: 'This will permanently delete the ticket channel.\n\nA transcript will be saved to the log channel if one is configured.\n\n**This action cannot be undone.**',
    confirmButton: 'Confirm Delete',
    cancelButton: 'Cancel',
    deleted: '🗑️ Ticket deleted.',
    logTitle: '🧾 Ticket Deleted',
    logTicket: 'Ticket',
    logDeletedBy: 'Deleted By',
    logDeletedAt: 'Deleted At',
    logTranscript: 'Transcript',
    logTranscriptAttached: 'Attached below.',
    logTranscriptFailed: 'Could not generate transcript.',
  },
  ticketEmbed: {
    createdBy: 'Created by',
    status: 'Status',
    priority: 'Priority',
    details: 'Details',
    claim: 'Claim',
    close: 'Close',
    addNote: 'Add Note',
    noteModalTitle: 'Add Staff Note',
    noteLabel: 'Note',
  },
  middleman: {
    paymentTitle: '💳 PAYMENT INFORMATION',
    paymentInfo: (bankName, accountNumber, accountHolder) => [
      '━━━━━━━━━━━━━━━━━━━━━━',
      `🏦  **BANK ${bankName.toUpperCase()}**`,
      '',
      '**Account Number:**',
      accountNumber,
      '',
      '**Account Holder:**',
      accountHolder,
      '━━━━━━━━━━━━━━━━━━━━━━',
    ].join('\n'),
    paymentInstructions: 'Instructions',
    paymentInstructionText: (amount) =>
      `**Buyer** must transfer **${amount}** to the account above.\nAfter payment, upload proof of payment in this ticket and wait for staff verification.`,
    selectPaymentTitle: '💳 Select Payment Method',
    selectPaymentDescription: 'Choose the payment method the **buyer** will use. The fee is added on top of the existing middleman fee.',
    feeNone: 'No additional fee',
    feeGopay: '+ Rp 1.000',
    feeOtherBank: '+ Rp 2.500',
    feeFooter: 'Fees are calculated server-side and cannot be changed by users.',
    bankModalTitle: 'Bank Name',
    bankLabel: 'Which bank will the buyer use?',
    bankPlaceholder: 'e.g. Mandiri, BRI, BNI, CIMB, SeaBank, Jago',
    summaryTitle: '💰 Transaction Summary',
    summaryText: (itemPrice, mmFee, payFee, payMethod, total) =>
      '```\n' +
      `Item Price      : ${itemPrice}\n` +
      `Middleman Fee   : ${mmFee}\n` +
      `Payment Fee     : ${payFee}\n` +
      `Payment Method  : ${payMethod}\n` +
      '─────────────────────────────\n' +
      `Final Total     : ${total}\n` +
      '```',
    participants: '👥 Participants',
    creator: '**Creator:**',
    buyer: '**Buyer:**',
    seller: '**Seller:**',
    buyerNotFound: (input) => `\`${input}\` *(not found)*`,
    sellerNotFound: (input) => `\`${input}\` *(not found)*`,
    itemPrice: '💵 Item Price',
    mmFee: '🏦 Middleman Fee',
    paymentFee: '💳 Payment Fee',
    paymentMethod: '🏧 Payment Method',
    feeResponsibility: '📋 Fee Responsibility',
    transactionId: '🆔 Transaction ID',
    buyerPays: '💰 Buyer Pays (Total)',
    sellerReceives: '📤 Seller Receives',
    status: '📊 Status',
    awaitingPayment: '⏳ Awaiting Payment',
    fundsReceived: '✅ Funds Received',
    fundsReceivedBy: '✅ Received By',
    fundsReceivedAt: '🕐 Received At',
    fundsButton: 'Funds Received',
    fundsConfirmed: (userId) =>
      `✅ Funds have been received and verified by <@${userId}>.\n\nThe transaction may now proceed.`,
    summaryFooter: 'Do not send payment until a staff member has verified both parties.',
    warningTitle: '⚠️ Participant Warning',
    warningAction: 'Action Required',
    warningActionStaff: (roleId) => `<@&${roleId}> — please add the missing participant(s) manually.`,
    warningActionNoRole: 'A staff member should add the missing participant(s) manually.',
    feeLabels: { buyer: 'Buyer Pays Fee', seller: 'Seller Pays Fee', split: 'Split 50/50' },
    validationBothRequired: 'Both Buyer and Seller fields are required.',
    validationAmountRequired: 'Transaction Amount is required.',
    validationAmountInvalid: 'Transaction Amount must be a valid number. Example: `500000` or `Rp 1.250.000`.',
    validationFeeRequired: 'Fee Responsibility is required. Enter `buyer`, `seller`, or `split`.',
    validationFeeInvalid: (raw) => `Fee Responsibility \`${raw}\` is not valid. Please enter **buyer**, **seller**, or **split**.`,
    validationSameUser: 'The Buyer and Seller cannot be the same user.',
  },
  notification: {
    closedTitle: '🔒 Your ticket has been closed',
    closedDescription: (num, type, reason, guildName) =>
      `**Ticket:** #${num} — ${type}\n**Reason:** ${reason}\n\nIf you need further help, open a new ticket in **${guildName}**.`,
    transactionTitle: '💳 Transaction Update',
    transactionDescription: (humanId, status, item) =>
      `**Ref:** \`${humanId}\`\n**Status:** ${status}\n**Item:** ${item}`,
    noReason: 'No reason provided',
  },
  modal: {
    supportTitle: 'Open Support Ticket',
    subject: 'Subject',
    subjectPlaceholder: 'Brief summary of your issue',
    description: 'Describe your issue',
    descriptionPlaceholder: 'Provide as much detail as possible...',
    attempted: 'What have you already tried?',
    attemptedPlaceholder: "Steps you've taken to resolve this...",
  },
};
