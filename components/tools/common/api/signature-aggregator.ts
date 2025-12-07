interface AggregateSignaturesParams {
  message: string;
  justification?: string;
  quorumPercentage?: number;
  signingSubnetId?: string;
}

interface AggregateSignaturesResponse {
  signedMessage: string;
}

export async function aggregateSignatures({
  message,
  justification,
  quorumPercentage,
  signingSubnetId,
}: AggregateSignaturesParams): Promise<string> {
  const endpoint =
    "https://glacier-api-dev.avax.network/v1/signatureAggregator/aggregateSignatures"; // notice the dev endpoint

  const requestBody: AggregateSignaturesParams = {
    message,
    ...(justification && { justification }),
    ...(quorumPercentage && { quorumPercentage }),
    ...(signingSubnetId && { signingSubnetId }),
  };

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    throw new Error(`Failed to aggregate signatures: ${response.statusText}`);
  }

  const data = (await response.json()) as AggregateSignaturesResponse;
  return data.signedMessage;
}
