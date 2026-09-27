import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { getWelz, useAppStore } from "../store";

type Step = 0 | 1 | 2 | 3;

export function OnboardingPage() {
  const [step, setStep] = useState<Step>(0);
  const [dataRoot, setDataRoot] = useState("");
  const pushToast = useAppStore((s) => s.pushToast);
  const setOnboardingComplete = useAppStore((s) => s.setOnboardingComplete);
  const navigate = useNavigate();

  async function chooseFolder() {
    const path = await getWelz().dialog.chooseDataRoot();
    if (path) setDataRoot(path);
  }

  async function finish() {
    if (dataRoot) {
      await getWelz().settings.set({ dataRoot });
    }
    await getWelz().onboarding.complete();
    setOnboardingComplete(true);
    pushToast("Welcome to WELZ Publisher.");
    navigate("/compose");
  }

  return (
    <div className="onboarding">
      <div className="card onboarding-card">
        {step === 0 && (
          <div className="onboarding-steps">
            <h1 className="page-title">Welcome to WELZ Publisher</h1>
            <p className="page-subtitle">Your local content operations workspace.</p>
            <button type="button" className="btn btn-primary" onClick={() => setStep(1)}>
              Get started
            </button>
          </div>
        )}
        {step === 1 && (
          <div className="onboarding-steps">
            <h2 className="page-title">Local storage</h2>
            <p className="page-subtitle">
              Choose where application data and media should be stored. You can use the default
              location or pick a folder.
            </p>
            <p className="mono">{dataRoot || "Default user data folder"}</p>
            <div className="actions-row">
              <button type="button" className="btn btn-secondary" onClick={() => void chooseFolder()}>
                Choose folder
              </button>
              <button type="button" className="btn btn-primary" onClick={() => setStep(2)}>
                Continue
              </button>
            </div>
          </div>
        )}
        {step === 2 && (
          <div className="onboarding-steps">
            <h2 className="page-title">Connect your first platform</h2>
            <p className="page-subtitle">
              Connect a supported platform now, or do this later from Platforms.
            </p>
            <div className="actions-row">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setStep(3);
                  navigate("/platforms");
                }}
              >
                Connect
              </button>
              <button type="button" className="btn btn-primary" onClick={() => setStep(3)}>
                Skip
              </button>
            </div>
          </div>
        )}
        {step === 3 && (
          <div className="onboarding-steps">
            <h2 className="page-title">You&apos;re ready</h2>
            <p className="page-subtitle">Create your first piece of content.</p>
            <button type="button" className="btn btn-primary" onClick={() => void finish()}>
              Create first post
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
