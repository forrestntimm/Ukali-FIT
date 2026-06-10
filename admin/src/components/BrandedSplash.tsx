import React from "react";
import wallpaperLogo from "../assets/wallpaper-logo.png";

type BrandedSplashProps = {
  title: string;
  subtitle: string;
  children?: React.ReactNode;
};

export default function BrandedSplash({ title, subtitle, children }: BrandedSplashProps) {
  return (
    <div className="branded-splash">
      <div className="branded-splash-backdrop" />
      <img className="branded-splash-logo" src={wallpaperLogo} alt="" aria-hidden="true" />
      <div className="branded-splash-shell">
        <div className="branded-splash-copy">
          <h1 className="branded-splash-title">{title}</h1>
          <p className="branded-splash-subtitle">{subtitle}</p>
        </div>
        {children ? <div className="branded-splash-content">{children}</div> : null}
      </div>
    </div>
  );
}
