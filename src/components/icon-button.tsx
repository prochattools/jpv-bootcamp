import { Button } from "@/components/ui/button";

const IconButton = ({
  text,
  isLeft,
  icon,
  isDownload,
  isDisable,
  isSubmit = true,
  isLoading,
}: any) => {
  return (
    <Button
      type={isSubmit ? "submit" : "button"}
      className="w-full px-6"
      disabled={isLoading}
    >
      {!isLoading ? (
        <span
          className={`flex items-center justify-center ${icon ? "gap-2" : ""}`}
        >
          {isLeft && (
            <span className={`${isDownload ? "rotate-90" : ""}`}>{icon}</span>
          )}
          <span>{text}</span>
          {!isLeft && !isDisable && (
            <span className={`${isDownload ? "rotate-90" : ""}`}>{icon}</span>
          )}
        </span>
      ) : (
        <div className="flex justify-center">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="animate-spin"
          >
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
        </div>
      )}
    </Button>
  );
};

export default IconButton;
