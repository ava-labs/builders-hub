"use client";
import { defineClientConfig } from "fumadocs-openapi/ui/client";
import { BodyFieldWithExpandedParams } from "./rpc-api-page.client";

export default defineClientConfig({
  storageKeyPrefix: "fumadocs-openapi-pchain-",
  playground: {
    renderBodyField: (fieldName, info) => {
      return <BodyFieldWithExpandedParams fieldName={fieldName} info={info} />;
    },
  },
});
