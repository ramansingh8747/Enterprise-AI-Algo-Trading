import React from "react";

interface LoadingSkeletonProps {
  width?: string;
  height?: string;
  radius?: number;
}

export default function LoadingSkeleton({
  width = "100%",
  height = "16px",
  radius = 8,
}: LoadingSkeletonProps) {
  return (
    <div
      aria-label="Loading"
      style={{
        width,
        height,
        borderRadius: radius,
        background:
          "linear-gradient(90deg,#1e293b 25%,#334155 50%,#1e293b 75%)",
        backgroundSize: "200% 100%",
        opacity: 0.6,
      }}
    />
  );
}
