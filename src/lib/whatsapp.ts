export const formatPhoneForWhatsApp = (phone: string) => {
  // Remove all non-numeric characters
  const cleaned = phone.replace(/\D/g, "");
  
  // If it doesn't start with 55 (Brazil), add it
  if (cleaned.length <= 11 && !cleaned.startsWith("55")) {
    return `55${cleaned}`;
  }
  
  return cleaned;
};

export const getWhatsAppLink = (phone: string, message: string) => {
  const formattedPhone = formatPhoneForWhatsApp(phone);
  const encodedMessage = encodeURIComponent(message);
  return `https://wa.me/${formattedPhone}?text=${encodedMessage}`;
};

export const openWhatsApp = (phone: string, message: string) => {
  const link = getWhatsAppLink(phone, message);
  window.open(link, "_blank");
};
