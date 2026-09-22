import Script from "next/script";

type GhlWebinarFormProps = {
  formId: string;
  formName: string;
  embedOrigin?: string;
  height?: number;
};

export default function GhlWebinarForm({
  formId,
  formName,
  embedOrigin = "https://link.constructionbusinessblueprint.co.uk",
  height = 695,
}: GhlWebinarFormProps) {
  const iframeId = `inline-${formId}`;

  return (
    <>
      <iframe
        src={`${embedOrigin}/widget/form/${formId}`}
        className="block w-full border-0 bg-white"
        style={{ minHeight: `${height}px` }}
        id={iframeId}
        data-layout="{'id':'INLINE'}"
        data-trigger-type="alwaysShow"
        data-trigger-value=""
        data-activation-type="alwaysActivated"
        data-activation-value=""
        data-deactivation-type="neverDeactivate"
        data-deactivation-value=""
        data-form-name={formName}
        data-height="undefined"
        data-layout-iframe-id={iframeId}
        data-form-id={formId}
        data-cookie-consent="true"
        data-cookie-consent-provider="auto"
        title={formName}
      />
      <Script src={`${embedOrigin}/js/form_embed.js`} strategy="afterInteractive" />
    </>
  );
}
