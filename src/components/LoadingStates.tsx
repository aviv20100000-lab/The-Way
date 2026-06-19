import { motion } from "framer-motion";

/**
 * Skeleton Loader — premium pulse animation
 */
export function SkeletonCard({
  height = "h-32",
  className = "",
}: {
  height?: string;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0.6 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1.5, repeat: Infinity, repeatType: "reverse" }}
      className={`${height} rounded-3xl bg-gradient-to-r from-neutral-100 to-neutral-50 shadow-micro ${className}`}
    />
  );
}

export function SkeletonLine({
  width = "w-full",
  className = "",
}: {
  width?: string;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0.6 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1.5, repeat: Infinity, repeatType: "reverse" }}
      className={`${width} h-4 rounded-lg bg-gradient-to-r from-neutral-100 to-neutral-50 ${className}`}
    />
  );
}

/**
 * Empty State — illustration, title, description, CTA
 */
export function EmptyState({
  emoji,
  title,
  description,
  actionLabel,
  onAction,
}: {
  emoji: string;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="flex flex-col items-center justify-center py-16 text-center"
    >
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1, duration: 0.4 }}
        className="text-6xl mb-4"
      >
        {emoji}
      </motion.div>

      <motion.h3
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.4 }}
        className="text-heading-base font-bold text-neutral-900 mb-2"
      >
        {title}
      </motion.h3>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.4 }}
        className="text-sm text-neutral-600 max-w-md mb-6"
      >
        {description}
      </motion.p>

      {actionLabel && onAction && (
        <motion.button
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.4 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onAction}
          className="rounded-2xl bg-gradient-to-r from-primary-600 to-primary-700 px-6 py-3 text-white font-semibold shadow-lg hover:shadow-floating transition-all duration-300"
        >
          {actionLabel}
        </motion.button>
      )}
    </motion.div>
  );
}

/**
 * Loading Spinner — elegant pulse
 */
export function LoadingSpinner() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col items-center justify-center py-12"
    >
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        className="text-4xl"
      >
        ⏳
      </motion.div>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="mt-4 text-sm text-neutral-600"
      >
        טוען...
      </motion.p>
    </motion.div>
  );
}

/**
 * Error State — for failed operations
 */
export function ErrorState({
  title = "שגיאה",
  description = "משהו השתבש. בואו נתחיל מחדש.",
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-12"
    >
      <div className="text-6xl mb-4">⚠️</div>
      <h3 className="text-heading-base font-bold text-neutral-900 mb-2">{title}</h3>
      <p className="text-sm text-neutral-600 max-w-md mb-6 text-center">{description}</p>
      {onRetry && (
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onRetry}
          className="rounded-2xl bg-gradient-to-r from-danger-600 to-danger-700 px-6 py-3 text-white font-semibold shadow-lg hover:shadow-floating transition-all"
        >
          נסה שוב
        </motion.button>
      )}
    </motion.div>
  );
}
