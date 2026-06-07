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
    title: 'Tickets',
    description: 'Need help or want to start a secure trade?\n\nSelect a ticket type below to get started.',
    languagePrompt: 'Language / Bahasa',
    languagePlaceholder: 'Select your language...',
    selectType: 'Select Ticket Type',
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
    created: (channelId: string) => `✅ Ticket created — <#${channelId}>`,
    alreadyOpen: (type: string, channelId: string) => `You already have an open ${type} ticket. Go to your existing ticket: <#${channelId}>`,
    cooldown: (type: string, ts: number) => `You are on cooldown. You can open another ${type} ticket <t:${ts}:R>.`,
    maxOpen: (max: number) => `You have reached the maximum of ${max} open tickets.`,
    notConfigured: 'Bot is not configured for this server. An admin must run `/setup` first.',
    blocked: 'You are not allowed to open tickets at this time. Contact an administrator if you believe this is a mistake.',
    noForm: 'This ticket type has no form configured.',
    createFailed: 'Failed to create ticket channel. Please contact an administrator — the bot may be missing `Manage Channels` permission in the ticket category.',
    saveFailed: 'Failed to save ticket. Please try again.',
    welcome: 'Please describe your issue in detail. A staff member will assist you shortly.',
    openedBy: 'Opened by',
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
