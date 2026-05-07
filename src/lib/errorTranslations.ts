export function translateFirebaseError(error: any): string {
  const message = typeof error === 'string' ? error : (error?.message || String(error));
  
  // Check for JSON string from handleFirestoreError
  try {
    if (message.startsWith('{') && message.endsWith('}')) {
      const parsed = JSON.parse(message);
      if (parsed.error) return translateFirebaseError(parsed.error);
    }
  } catch (e) {
    // Not a JSON string, continue with normal translation
  }

  if (message.includes('quota-exceeded') || message.includes('Quota exceeded')) {
    return "Limite de cota excedido. O limite diário de operações do banco de dados foi atingido. A cota será reiniciada amanhã.";
  }

  if (message.includes('permission-denied') || message.includes('insufficient permissions')) {
    return "Permissão negada. Você não tem autorização para realizar esta operação ou os dados são inválidos.";
  }

  if (message.includes('unavailable') || message.includes('Failed to get document because the client is offline')) {
    return "O serviço está temporariamente indisponível ou você está sem conexão com a internet.";
  }

  if (message.includes('network-error') || message.includes('network error')) {
    return "Erro de rede. Verifique sua conexão com a internet.";
  }

  if (message.includes('unauthenticated')) {
    return "Sessão expirada. Por favor, faça login novamente.";
  }

  if (message.includes('already-exists')) {
    return "Este registro já existe no sistema.";
  }

  return message;
}
