"use client";
const bls = require("@noble/bls12-381");
import React, { useState } from "react";
import { CodeBlock, Pre } from "fumadocs-ui/components/codeblock";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/inputWithLabel";

const bufferToHex = (buffer: ArrayBufferLike): string => {
  return [...new Uint8Array(buffer)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

const checkSig = async (
  signature: string,
  publicKey: string,
  message: string
) => {
  try {
    let res = await bls.verify(
      signature,
      new TextEncoder().encode(message),
      publicKey
    );
    return res;
  } catch (error) {
    console.error(error);
    return false;
  }
};

export const GenerateKeysButton: React.FC = () => {
  const [privKey, setPrivKey] = useState<string | null>(null);
  const [pubKey, setPubKey] = useState<string | null>(null);
  const generateKeys = () => {
    const privKey = new Uint8Array(32);
    crypto.getRandomValues(privKey);
    const pubKey = bufferToHex(bls.getPublicKey(privKey));
    setPrivKey(bufferToHex(privKey.buffer));
    setPubKey(pubKey);
    return { privKey, pubKey };
  };

  return (
    <div>
      <button className={buttonVariants()} onClick={generateKeys}>
        Generate Keys
      </button>

      {privKey && (
        <CodeBlock title="🗝️ Private Key" lang="bash" allowCopy={true}>
          <Pre>{privKey}</Pre>
        </CodeBlock>
      )}

      {pubKey && (
        <CodeBlock title="🔑 Public Key:" lang="bash" allowCopy={true}>
          <Pre>{pubKey}</Pre>
        </CodeBlock>
      )}
    </div>
  );
};

export const SignMessageButton: React.FC = () => {
  const [privKey, setPrivKey] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [signature, setSignature] = useState<string | null>(null);

  const signMessage = async () => {
    if (!privKey || !message) {
      return;
    }
    setSignature(
      bufferToHex(await bls.sign(new TextEncoder().encode(message), privKey))
    );
  };

  return (
    <div>
      <Input
        id="privatekey"
        label="🗝️ Private Key"
        description="Enter private key to sign message with"
        placeholder="3a408d0..."
        onChange={(e) => setPrivKey(e.target.value)}
      />

      <Input
        id="message"
        label="📝 Message"
        description="Enter any Message you want to sign with the Private Key"
        placeholder="Hello"
        onChange={(e) => setMessage(e.target.value)}
      />

      <button
        className={buttonVariants()}
        onClick={signMessage}
        disabled={!privKey || !message}
      >
        Sign Message
      </button>

      {signature && (
        <CodeBlock title="🔏 Signature:" lang="bash" allowCopy={true}>
          <Pre>{signature}</Pre>
        </CodeBlock>
      )}
    </div>
  );
};

export const VerifySignatureButton: React.FC<{ aggregated?: boolean }> = ({
  aggregated,
}) => {
  const [pubKey, setPubKey] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [signature, setSignature] = useState<string | null>(null);
  const [isValid, setIsValid] = useState<boolean | null>(null);

  const verifySignature = async () => {
    if (signature && pubKey && message) {
      checkSig(signature, pubKey, message).then((res) => {
        if (res) {
          setIsValid(res);
        } else {
          setIsValid(false);
        }
      });
    }
  };

  return (
    <div>
      <Input
        id="pubKey"
        label={`🔑 ${aggregated ? "Aggregated " : ""}Public Key`}
        description="Enter the Public Key that signed the Message."
        placeholder="8f65ab..."
        onChange={(e) => setPubKey(e.target.value)}
      />

      <Input
        id="message"
        label="📝 Message"
        description="Enter the Message that was signed."
        placeholder="Hello"
        onChange={(e) => setMessage(e.target.value)}
      />

      <Input
        id="signature"
        label={`🔏 ${aggregated ? "Aggregated " : ""}Signature`}
        description="Enter the Signature of the Message."
        placeholder="8495e11..."
        onChange={(e) => setSignature(e.target.value)}
      />

      <button
        className={buttonVariants()}
        onClick={verifySignature}
        disabled={!signature || !pubKey || !message}
      >
        Verify Signature
      </button>

      {isValid !== null && (
        <p>{isValid ? "✅ Signature is valid!" : "❌ Signature is invalid!"}</p>
      )}
    </div>
  );
};

export const AggregateSignaturesButton: React.FC = () => {
  const [signature1, setSignature1] = useState<string | null>(null);
  const [signature2, setSignature2] = useState<string | null>(null);
  const [aggregatedSignature, setAggregatedSignature] = useState<string | null>(
    null
  );
  const [showAggregatedSignature, setShowAggregatedSignature] = useState(false);

  return (
    <div>
      <Input
        id="signature"
        label="🔏 First Signature"
        description="Enter the first Signature of the Message."
        placeholder="8495e11..."
        onChange={(e) => setSignature1(e.target.value)}
      />
      <Input
        id="signature2"
        label="🔏 Second Signature"
        description="Enter the second Signature of the Message."
        placeholder="a3d1e34..."
        onChange={(e) => setSignature2(e.target.value)}
      />
      <button
        className={buttonVariants()}
        onClick={() => {
          if (signature1 && signature2) {
            setAggregatedSignature(
              bufferToHex(bls.aggregateSignatures([signature1, signature2]))
            );
            setShowAggregatedSignature(true);
          }
        }}
      >
        Aggregate Signatures
      </button>

      {showAggregatedSignature && (
        <>
          {aggregatedSignature && (
            <CodeBlock
              title="🔏 Aggregated Signature:"
              lang="bash"
              allowCopy={true}
            >
              <Pre>{aggregatedSignature}</Pre>
            </CodeBlock>
          )}
        </>
      )}
    </div>
  );
};

export const AggregatePublicKeysButton: React.FC = () => {
  const [pubKey1, setPubKey1] = useState<string | null>(null);
  const [pubKey2, setPubKey2] = useState<string | null>(null);
  const [aggregatedPubKey, setAggregatedPubKey] = useState<string | null>(null);
  const [showAggregatedPubKey, setShowAggregatedPubKey] = useState(false);

  return (
    <div>
      <Input
        id="pubkey1"
        label="🔑 First Public Key"
        description="Enter the first Public Key to aggregate."
        placeholder="04ae67..."
        onChange={(e) => setPubKey1(e.target.value)}
      />
      <Input
        id="pubkey2"
        label="🔑 Second Public Key"
        description="Enter the second Public Key to aggregate."
        placeholder="04ae67..."
        onChange={(e) => setPubKey2(e.target.value)}
      />

      <button
        className={buttonVariants()}
        onClick={() => {
          if (pubKey1 && pubKey2) {
            setAggregatedPubKey(
              bufferToHex(bls.aggregatePublicKeys([pubKey1, pubKey2]))
            );
            setShowAggregatedPubKey(true);
          }
        }}
      >
        Aggregate Public Keys
      </button>

      {showAggregatedPubKey && (
        <>
          {aggregatedPubKey && (
            <CodeBlock
              title="🔑 Aggregated Public Key:"
              lang="bash"
              allowCopy={true}
            >
              <Pre>{aggregatedPubKey}</Pre>
            </CodeBlock>
          )}
        </>
      )}
    </div>
  );
};
