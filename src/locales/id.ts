import type { Locale } from './en';

export const id: Locale = {
  panel: {
    title: 'Tickets',
    description: 'Butuh bantuan atau ingin memulai transaksi yang aman?\n\nPilih jenis tiket di bawah ini untuk memulai.',
    languagePrompt: 'Language / Bahasa',
    languagePlaceholder: 'Pilih bahasa Anda...',
    selectType: 'Pilih Jenis Tiket',
    typePlaceholder: 'Pilih jenis tiket...',
  },
  ticketTypes: {
    middleman: {
      label: 'Middleman',
      description: 'Buat transaksi middleman yang aman.',
    },
    tickets: {
      label: 'Support',
      description: 'Hubungi staff untuk bantuan.',
    },
  },
  ticket: {
    created: (channelId: string) => `✅ Tiket dibuat — <#${channelId}>`,
    alreadyOpen: (type: string, channelId: string) => `Kamu sudah memiliki tiket ${type} yang aktif. Pergi ke tiket kamu: <#${channelId}>`,
    cooldown: (type: string, ts: number) => `Kamu sedang dalam cooldown. Kamu bisa membuka tiket ${type} lagi <t:${ts}:R>.`,
    maxOpen: (max: number) => `Kamu telah mencapai batas maksimum ${max} tiket yang terbuka.`,
    notConfigured: 'Bot belum dikonfigurasi untuk server ini. Admin harus menjalankan `/setup` terlebih dahulu.',
    blocked: 'Kamu tidak diizinkan membuka tiket saat ini. Hubungi administrator jika kamu merasa ini adalah kesalahan.',
    noForm: 'Jenis tiket ini tidak memiliki formulir yang dikonfigurasi.',
    createFailed: 'Gagal membuat saluran tiket. Hubungi administrator — bot mungkin tidak memiliki izin `Manage Channels` di kategori tiket.',
    saveFailed: 'Gagal menyimpan tiket. Silakan coba lagi.',
    welcome: 'Silakan jelaskan masalahmu secara detail. Staff akan segera membantu kamu.',
    openedBy: 'Dibuka oleh',
  },
  modal: {
    supportTitle: 'Buka Tiket Dukungan',
    subject: 'Subjek',
    subjectPlaceholder: 'Ringkasan singkat masalah kamu',
    description: 'Jelaskan masalah kamu',
    descriptionPlaceholder: 'Berikan detail sebanyak mungkin...',
    attempted: 'Apa yang sudah kamu coba?',
    attemptedPlaceholder: 'Langkah-langkah yang sudah kamu ambil...',
  },
};
