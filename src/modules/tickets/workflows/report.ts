import { ModalSubmitInteraction } from 'discord.js';
import { TicketManager } from '../TicketManager';

const manager = new TicketManager();

export async function handleReportOpen(interaction: ModalSubmitInteraction) {
  const targetId  = interaction.fields.getTextInputValue('target_id');
  const reason    = interaction.fields.getTextInputValue('reason');
  const evidence  = interaction.fields.getTextInputValue('evidence');

  await manager.createTicket({
    guildId:  interaction.guildId!,
    userId:   interaction.user.id,
    userTag:  interaction.user.tag,
    type:     'REPORT',
    formData: { targetId, reason, evidence },
  }, interaction);
}
