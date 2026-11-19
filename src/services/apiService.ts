export {
  AiUnavailableError,
  buildAnonymizedOperationalSnapshot,
  fetchLiveAnonymizedSnapshotFromFirestore,
  GEMINI_FREE_TIER_MODEL,
  generateGeminiInventoryReport as generateAiInventoryReport,
  runGeminiStockAnalysis as fetchAiStockAnalysis,
  SAFETY_DISCLAIMER,
  sendGeminiAssistantMessage as sendAiAssistantMessage,
  type ChatHistoryTurn,
  type OperationalDatasetInput,
} from './aiService';
