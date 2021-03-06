import { scaleLinear } from "d3-scale";
import { motion } from "framer-motion";
import { range } from "lodash";
import React, { FC, memo } from "react";

import { ICourse } from "../../../../../interfaces";
import { ForeplanHelperStore } from "../../../context/ForeplanContext";
import { useUser } from "../../../utils/useUser";
import styles from "./foreplanCourseBox.module.css";

export const failRateColorScalePositive = scaleLinear<string, number>();

export const failRateColorScaleNegative = scaleLinear<string, number>();

const ForeplanCourseStats: FC<Pick<ICourse, "code">> = memo(({ code }) => {
  const failRate = ForeplanHelperStore.hooks.useForeplanCourseFailRate(code);
  const effort = ForeplanHelperStore.hooks.useForeplanCourseEffort(code);
  const fillColor =
    failRate >= 0.3
      ? ((failRateColorScaleNegative(failRate) as unknown) as string)
      : ((failRateColorScalePositive(failRate) as unknown) as string);

  const { user } = useUser();

  return (
    <motion.div
      key="foreplanCourseStats"
      initial={{
        opacity: 0,
      }}
      animate={{ opacity: 1 }}
      exit={{
        opacity: 0,
      }}
      className={styles.courseStats}
    >
      {user?.config.FOREPLAN_COURSE_FAIL_RATE_STATS && (
        <svg height="10px" width="10px">
          <rect width="10px" height="10px" fill={fillColor} />
        </svg>
      )}

      {user?.config.FOREPLAN_COURSE_EFFORT_STATS && (
        <svg className={styles.courseEffortStats} height="10px" width="20px">
          {range(0, effort).map((i) => {
            return (
              <rect
                key={i}
                height="10px"
                width="1px"
                x={i * 3}
                y={0}
                fill="black"
              />
            );
          })}
        </svg>
      )}
    </motion.div>
  );
});

export default ForeplanCourseStats;
