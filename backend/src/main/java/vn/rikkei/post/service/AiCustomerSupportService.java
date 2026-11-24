package vn.rikkei.post.service;

import vn.rikkei.post.dto.ai.*;

public interface AiCustomerSupportService {

    AiChatResponse chat(AiChatRequest request);

    PredictEtaResponse predictEta(PredictEtaRequest request);
}
