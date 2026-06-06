import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { MiddlemanManager } from '../../modules/middleman/MiddlemanManager';
import { PremiumService } from '../../services/PremiumService';
import { errorEmbed } from '../../components/embeds/error';

const mm = new MiddlemanManager();
const premium = new PremiumService();

export const data = new SlashCommandBuilder()
  .setName('mm-create')
  .setDescription('Create a middleman transaction')
  .addUserOption(o => o.setName('buyer').setDescription('The buyer').setRequired(true))
  .addUserOption(o => o.setName('seller').setDescription('The seller').setRequired(true))
  .addStringOption(o => o.setName('item').setDescription('Item being sold').setRequired(true))
  .addNumberOption(o => o.setName('amount').setDescription('Transaction amount').setRequired(true))
  .addStringOption(o => o.setName('currency').setDescription('Currency (e.g. USD, BTC)').setRequired(false));

export async function execute(interaction: ChatInputCommandInteraction) {
  const isPremium = await premium.isPremium(interaction.guildId!);
  if (!isPremium) return interaction.reply({ embeds: [errorEmbed('Middleman system requires Premium.')], ephemeral: true });

  const buyer    = interaction.options.getUser('buyer',  true);
  const seller   = interaction.options.getUser('seller', true);
  const item     = interaction.options.getString('item',   true);
  const amount   = interaction.options.getNumber('amount', true);
  const currency = interaction.options.getString('currency') ?? 'USD';

  await mm.createTransaction({
    guildId: interaction.guildId!,
    initiatorId: interaction.user.id,
    buyerId: buyer.id,
    sellerId: seller.id,
    item, amount, currency
  }, interaction);
}
