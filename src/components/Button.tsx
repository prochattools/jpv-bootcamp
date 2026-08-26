import React from "react";
import { Button as JpvButton } from "@/components/ui/button";

const Button = ({
  text,
  onClick,
  disabled,
  isLoading,
}: {
  text: string;
  onClick?: () => void;
  disabled?: boolean;
  isLoading?: boolean;
}) => {
  return (
    <JpvButton
      onClick={onClick}
      className="px-8"
      disabled={disabled || false}
    >
      {isLoading ? (
        <span className="loading loading-spinner loading-xs"></span>
      ) : (
        text
      )}
    </JpvButton>
  );
};

export default Button;
