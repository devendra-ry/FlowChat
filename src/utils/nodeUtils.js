export const createNode = (id, message, position, isAI, isLoading, isInput, history = [], onResponseClick, onInputSubmit) => ({
  id,
  type: 'chatNode',
  position,
  data: {
    message,
    isAI,
    isLoading,
    isInput,
    nodeId: id,
    responses: isAI && !isLoading && !isInput ? ['Continue this topic', 'Ask a new question from here'] : null,
    onResponseClick: (isAI && !isLoading && !isInput) ? (response) => onResponseClick(response, id) : null,
    onInputSubmit: isInput ? (msg) => onInputSubmit(msg, id) : null,
    history: isInput || isLoading ? history : [...history, { message, sender: isAI ? 'ai' : 'user' }],
  },
});