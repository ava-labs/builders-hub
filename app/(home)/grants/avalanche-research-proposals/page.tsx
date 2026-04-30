"use client";

import { AvalancheLogo } from "@/components/navigation/avalanche-logo";
import { useState, useEffect, useRef } from "react";
import { useSession, getSession } from "next-auth/react";
import { useLoginModalTrigger, useLoginCompleteListener } from "@/hooks/useLoginModal";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Loader2, CheckCircle2, Info, AlertCircle, LogIn } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Form, FormField, FormItem, FormControl, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { formSchema, researchAreas, MAX_BUDGET_USD, type ResearchProposalFormData } from "@/types/researchProposalForm";

const LINK_HELPER = "Make sure the link is set to \"Anyone with the link can view\" so reviewers can access it without a request.";

export default function ResearchProposalForm() {
  const { data: session, status, update } = useSession();
  const { openLoginModal } = useLoginModalTrigger();
  const hasTriggeredModalRef = useRef(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionStatus, setSubmissionStatus] = useState<"success" | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [authGateState, setAuthGateState] = useState<"checking" | "ready" | "prompt">("checking");

  useLoginCompleteListener(async () => {
    await update();
    hasTriggeredModalRef.current = false;
    setAuthGateState("ready");
  });

  const form = useForm<ResearchProposalFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      lead_full_name: "",
      email: "",
      affiliation: "",
      proposal_title: "",
      primary_research_area: undefined,
      primary_research_area_other: "",
      budget_usd: undefined as unknown as number,
      proposal_url: "",
      lead_cv_url: "",
      co_investigators: "",
      co_investigator_cvs_url: "",
      exclusivity_agreement: false,
    },
    mode: "onChange",
  });

  const selectedArea = form.watch("primary_research_area");

  // Prefill email from session
  useEffect(() => {
    if (session?.user?.email) {
      form.setValue("email", session.user.email);
    }
  }, [session?.user?.email, form]);

  useEffect(() => {
    if (selectedArea !== "Other" && form.getValues("primary_research_area_other")) {
      form.setValue("primary_research_area_other", "");
    }
  }, [selectedArea, form]);

  // Show login modal for unauthenticated users
  useEffect(() => {
    if (status === "loading") {
      setAuthGateState("checking");
      return;
    }

    if (status === "authenticated" && session?.user) {
      setAuthGateState("ready");
      return;
    }

    const checkAndTriggerModal = async () => {
      const freshSession = await getSession();
      if (freshSession?.user) {
        setAuthGateState("ready");
        return;
      }

      setAuthGateState("prompt");

      if (!hasTriggeredModalRef.current) {
        hasTriggeredModalRef.current = true;
        openLoginModal(window.location.href);
      }
    };

    setAuthGateState("checking");
    checkAndTriggerModal();
  }, [status, session, openLoginModal]);

  async function onSubmit(values: ResearchProposalFormData) {
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const response = await fetch("/api/grants/avalanche-research-proposals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      const result = (await response.json().catch(() => null)) as
        | { success?: boolean; message?: string }
        | null;

      if (!response.ok || !result?.success) {
        throw new Error(result?.message || "Failed to submit proposal");
      }

      setSubmitError(null);
      setSubmissionStatus("success");
      form.reset();
      if (session?.user?.email) form.setValue("email", session.user.email);
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "We couldn't submit your proposal. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (status === "loading" || authGateState === "checking") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (authGateState === "prompt") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-secondary">
            <AvalancheLogo className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Sign in to continue</h1>
          <p className="mt-3 text-muted-foreground">
            Research proposal submissions are tied to a signed-in account so we can protect your
            application and keep follow-up communication consistent.
          </p>
          <Button className="mt-6 min-w-48" onClick={() => openLoginModal(window.location.href)}>
            <LogIn className="mr-2 h-4 w-4" />
            Open Sign-In
          </Button>
        </div>
      </div>
    );
  }

  if (submissionStatus === "success") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="text-center">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-accent">
            <CheckCircle2 className="h-10 w-10 text-accent-foreground" />
          </div>
          <h1 className="mb-4 text-3xl font-bold text-foreground">Proposal Submitted!</h1>
          <p className="mx-auto max-w-md text-muted-foreground">
            Thank you for submitting your research proposal. We&apos;ll review it and get back to you at the email you provided.
          </p>
          <Button
            className="mt-8"
            onClick={() => {
              setSubmitError(null);
              setSubmissionStatus(null);
              form.reset();
              if (session?.user?.email) form.setValue("email", session.user.email);
            }}
          >
            Submit Another Proposal
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-center gap-3">
          <AvalancheLogo className="h-10 w-10" />
          <span className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Avalanche Research Proposals
          </span>
        </div>

        <div className="mb-8 space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground sm:text-4xl">
              Research Proposal Submission
            </h1>
            <p className="mt-2 text-lg text-muted-foreground">
              The Economics of Cryptoassets and Decentralized Networks
            </p>
          </div>

          <p className="text-muted-foreground">
            The Avalanche Foundation is funding original academic research on the economics of decentralised networks. We are offering grants of up to ${MAX_BUDGET_USD.toLocaleString()} USD across two interconnected areas.
          </p>

          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">What We Are Looking For</h2>

            <div>
              <h3 className="font-semibold text-foreground">Area 1: Cryptoasset Pricing and Valuation</h3>
              <p className="mt-2 text-muted-foreground">
                Cryptoassets do not fit neatly into existing asset pricing frameworks. They exhibit characteristics of currencies, equity-like claims on network revenues, and access tokens to utility and services simultaneously — especially the native assets of proof-of-stake blockchains.
              </p>
              <p className="mt-2 text-muted-foreground">
                We are seeking research that develops and tests frameworks for understanding how value accrues in these systems, with particular attention to protocol-level design choices and their long-term implications. Topics of interest include theoretical models of cryptoasset valuation, the role of monetary policy and token emission schedules in determining asset prices and expected returns, how network adoption and usage relate to fundamental value, and novel approaches to value accrual that extend beyond network usage alone.
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-foreground">Area 2: Validator Economics and Network Security</h3>
              <p className="mt-2 text-muted-foreground">
                Proof-of-stake networks depend on well-designed economic incentives to maintain security and consensus. Research in this area should examine how validator incentive systems are structured, measured, and optimised.
              </p>
              <p className="mt-2 text-muted-foreground">
                We are particularly interested in work that explores optimal staking ratios, the economics of opportunity cost and required returns for validators, metrics for assessing validator set health and decentralisation, and non-inflation-based reward mechanisms that support sustainable long-term outcomes.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-foreground">Who Should Apply</h2>
            <p className="text-muted-foreground">
              This call is open to academic researchers and independent scholars in economics, finance, computer science, engineering, and related disciplines. Proposals are assessed on relevance, methodological rigour, novelty, feasibility, and researcher qualifications.
            </p>
            <p className="text-muted-foreground">
              Proposals should be no longer than 10 pages and must include a clear research question, proposed methodology, expected contributions, timeline, budget justification, and researcher CVs.
            </p>
          </div>

          <p className="rounded-lg border border-border bg-secondary/40 px-4 py-3 text-sm font-medium text-foreground">
            Deadline: Monday, June 1st, 2026.
          </p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <div className="space-y-6 rounded-xl border border-border bg-card p-6 sm:p-8">
              {submitError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Submission failed</AlertTitle>
                  <AlertDescription>{submitError}</AlertDescription>
                </Alert>
              )}

              <FormField
                control={form.control}
                name="lead_full_name"
                render={({ field }) => (
                  <FormItem className="space-y-2">
                    <Label>Lead Researcher Full Name *</Label>
                    <FormControl>
                      <Input placeholder="Jane Doe" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem className="space-y-2">
                    <Label>Primary Email Address *</Label>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="you@university.edu"
                        readOnly
                        autoComplete="email"
                        className="bg-muted/40"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      This uses the verified email from your signed-in account for all
                      correspondence, including award notifications.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="affiliation"
                render={({ field }) => (
                  <FormItem className="space-y-2">
                    <Label>Affiliation *</Label>
                    <FormControl>
                      <Input placeholder="University, Institution, or Independent Scholar" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="proposal_title"
                render={({ field }) => (
                  <FormItem className="space-y-2">
                    <Label>Proposal Title *</Label>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="primary_research_area"
                render={({ field }) => (
                  <FormItem className="space-y-2">
                    <Label>Primary Research Area of Focus *</Label>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a research area" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {researchAreas.map((area) => (
                          <SelectItem key={area} value={area}>
                            {area}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {selectedArea === "Other" && (
                <FormField
                  control={form.control}
                  name="primary_research_area_other"
                  render={({ field }) => (
                    <FormItem className="space-y-2">
                      <Label>Please describe your research area *</Label>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name="budget_usd"
                render={({ field: { onChange, value, ...rest } }) => (
                  <FormItem className="space-y-2">
                    <Label>Estimated Total Budget Requested (USD) *</Label>
                    <FormControl>
                      <Input
                        type="number"
                        inputMode="numeric"
                        min={1}
                        max={MAX_BUDGET_USD}
                        step={1}
                        placeholder="e.g. 35000"
                        value={value ?? ""}
                        onChange={(e) => {
                          const nextValue = e.target.valueAsNumber;
                          onChange(Number.isNaN(nextValue) ? undefined : nextValue);
                        }}
                        {...rest}
                      />
                    </FormControl>
                    <FormDescription>
                      Whole dollars. Maximum ${MAX_BUDGET_USD.toLocaleString()} USD.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="proposal_url"
                render={({ field }) => (
                  <FormItem className="space-y-2">
                    <Label>Research Proposal Link *</Label>
                    <FormControl>
                      <Input type="url" placeholder="https://drive.google.com/..." {...field} />
                    </FormControl>
                    <FormDescription className="flex items-start gap-2">
                      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span>
                        Link to a single PDF, Word, or Markdown document (max 10 pages excluding references). {LINK_HELPER}
                      </span>
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="lead_cv_url"
                render={({ field }) => (
                  <FormItem className="space-y-2">
                    <Label>Lead Researcher Resume / CV Link *</Label>
                    <FormControl>
                      <Input type="url" placeholder="https://drive.google.com/..." {...field} />
                    </FormControl>
                    <FormDescription className="flex items-start gap-2">
                      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span>{LINK_HELPER}</span>
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="co_investigators"
                render={({ field }) => (
                  <FormItem className="space-y-2">
                    <Label>Co-Investigators</Label>
                    <FormControl>
                      <Textarea
                        rows={3}
                        placeholder="Optional. List names and affiliations of any co-investigators on this project."
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="co_investigator_cvs_url"
                render={({ field }) => (
                  <FormItem className="space-y-2">
                    <Label>Co-Investigators&apos; Resume / CV Link</Label>
                    <FormControl>
                      <Input type="url" placeholder="https://drive.google.com/..." {...field} />
                    </FormControl>
                    <FormDescription className="flex items-start gap-2">
                      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span>
                        Optional. A single link to a folder or document containing all co-investigator CVs. {LINK_HELPER}
                      </span>
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="exclusivity_agreement"
                render={({ field }) => (
                  <FormItem className="space-y-3 rounded-lg border border-border bg-secondary/40 p-4">
                    <Label className="text-sm font-semibold">Six-Month Exclusivity Agreement *</Label>
                    <p className="text-sm text-muted-foreground">
                      I understand and agree to the six-month exclusivity period for all research outputs before public dissemination or journal submission. (Agreement is required for submission.)
                    </p>
                    <div className="flex items-start gap-3">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          id="exclusivity_agreement"
                        />
                      </FormControl>
                      <Label htmlFor="exclusivity_agreement" className="cursor-pointer text-sm font-normal">
                        Yes, I agree
                      </Label>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="mt-6 flex justify-end">
              <Button type="submit" disabled={isSubmitting} className="min-w-40">
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  "Submit Proposal"
                )}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
}
