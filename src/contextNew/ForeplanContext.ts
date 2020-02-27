import { every, reduce, size } from "lodash";
import { FC, memo, useEffect, useState } from "react";
import { createStore } from "react-state-selector";
import { useDebounce } from "react-use";

import { useMutation, useQuery } from "@apollo/react-hooks";

import { StateCourse } from "../../constants";
import { ICourse } from "../../interfaces";
import { PerformanceByLoad } from "../../typings/graphql";
import { useTracking } from "../context/Tracking";
import {
  GET_PERSISTENCE_VALUE,
  SET_PERSISTENCE_VALUE,
} from "../graphql/queries";
import { useDashboardInputState } from "../pages";
import { stringListToBooleanMap } from "../utils";
import { useIsPersistenceLoading } from "../utils/usePersistenceLoading";
import { useUser } from "../utils/useUser";

const emptyObject = Object.freeze({});
const emptyArray = Object.freeze([]) as [];

interface IForeplanHelperData {
  courseDirectTake: Record<string, boolean | undefined>;
  courseFailRate: Record<string, number>;
  courseEffort: Record<string, number>;
  advices: PerformanceByLoad[];
}

const defaultForeplanHelperStore: IForeplanHelperData = Object.freeze({
  courseDirectTake: emptyObject,
  courseFailRate: emptyObject,
  courseEffort: emptyObject,
  advices: emptyArray,
});

export const ForeplanHelperStore = createStore(defaultForeplanHelperStore, {
  hooks: {
    useForeplanIsDirectTake: (
      { courseDirectTake },
      { code }: { code: string }
    ) => {
      return (
        courseDirectTake[code] ||
        (courseDirectTake === emptyObject ? undefined : false)
      );
    },
    useForeplanCourseFailRate: (
      { courseFailRate },
      { code }: { code: string }
    ) => {
      return courseFailRate[code] || 0;
    },
    useForeplanCourseEffort: ({ courseEffort }, { code }: { code: string }) => {
      return courseEffort[code] || 1;
    },
    useForeplanAdvice: (
      { advices },
      { totalCreditsTaken }: { totalCreditsTaken: number }
    ) => {
      return (
        advices.find(({ lowerBoundary, upperBoundary }) => {
          if (
            totalCreditsTaken >= lowerBoundary &&
            totalCreditsTaken <= upperBoundary
          ) {
            return true;
          }
          return false;
        }) ??
        (() => {
          console.warn("Advice not found for ", totalCreditsTaken);
          return advices[advices.length - 1];
        })()
      );
    },
    useForeplanAdvices: ({ advices }) => advices,
  },
  actions: {
    setDirectTakeData: (data: string[]) => draft => {
      draft.courseDirectTake = stringListToBooleanMap(data);
    },
    setFailRateData: (data: { code: string; failRate: number }[]) => draft => {
      draft.courseFailRate = data.reduce<Record<string, number>>(
        (acum, { code, failRate }) => {
          acum[code] = failRate;
          return acum;
        },
        {}
      );
    },
    setEffortData: (data: { code: string; effort: number }[]) => draft => {
      draft.courseEffort = data.reduce<Record<string, number>>(
        (acum, { code, effort }) => {
          acum[code] = effort;
          return acum;
        },
        {}
      );
    },
    setForeplanAdvices: (advices: IForeplanHelperData["advices"]) => draft => {
      draft.advices = advices;
    },
  },
});

export type ICreditsNumber = { credits: number };

export interface IForeplanActiveData {
  active: boolean;
  foreplanCourses: Record<string, Pick<ICourse, "name"> & ICreditsNumber>;
  totalCreditsTaken: number;
  futureCourseRequisites: {
    [coursesToOpen: string]: { [requisite: string]: boolean | undefined };
  };
}

const defaultForeplanActiveData: IForeplanActiveData = Object.freeze({
  active: false,
  foreplanCourses: emptyObject,
  totalCreditsTaken: 0,
  futureCourseRequisites: emptyObject,
});

export const ForeplanActiveStore = createStore(defaultForeplanActiveData, {
  actions: {
    activateForeplan: () => draft => {
      draft.active = true;
    },
    disableForeplan: () => draft => {
      draft.active = false;
    },
    addCourseForeplan: (
      course: string,
      data: IForeplanActiveData["foreplanCourses"][string]
    ) => draft => {
      draft.foreplanCourses[course] = data;

      draft.totalCreditsTaken = reduce(
        draft.foreplanCourses,
        (acum, { credits }) => {
          return acum + credits;
        },
        0
      );
    },
    removeCourseForeplan: (course: string) => draft => {
      delete draft.foreplanCourses[course];

      draft.totalCreditsTaken = reduce(
        draft.foreplanCourses,
        (acum, { credits }) => {
          return acum + credits;
        },
        0
      );
    },
    setNewFutureCourseRequisites: (
      indirectTakeCourses: { course: string; requisitesUnmet: string[] }[]
    ) => draft => {
      draft.futureCourseRequisites = indirectTakeCourses.reduce<
        IForeplanActiveData["futureCourseRequisites"]
      >((acum, { course, requisitesUnmet }) => {
        acum[course] = requisitesUnmet.reduce<
          IForeplanActiveData["futureCourseRequisites"][string]
        >((reqAcum, reqCode) => {
          reqAcum[reqCode] = false;
          return reqAcum;
        }, {});
        return acum;
      }, {});
    },
    setFutureCourseRequisitesState: (
      courseToSetState: string,
      state: boolean
    ) => draft => {
      for (const courseToOpen in draft.futureCourseRequisites) {
        if (
          draft.futureCourseRequisites[courseToOpen]?.[courseToSetState] !==
          undefined
        ) {
          draft.futureCourseRequisites[courseToOpen][courseToSetState] = state;
          // draft.futureCourseRequisites[courseToOpen] = {
          //   ...draft.futureCourseRequisites[courseToOpen],
          //   [courseToSetState]: state,
          // };
        }
      }
    },
    reset: (data: IForeplanActiveData = defaultForeplanActiveData) => () =>
      data,
  },
  hooks: {
    useIsForeplanCourseChecked: (
      { foreplanCourses },
      { code }: { code: string }
    ) => {
      return !!foreplanCourses[code];
    },
    useForeplanTotalCreditsTaken: ({ totalCreditsTaken }) => {
      return totalCreditsTaken;
    },
    useForeplanCoursesSize: ({ foreplanCourses }) => {
      return size(foreplanCourses);
    },
    useAnyForeplanCourses: ({ foreplanCourses }) => {
      return size(foreplanCourses) > 0;
    },
    useIsForeplanActive: ({ active }) => {
      return active;
    },
    useForeplanCourses: ({ foreplanCourses }) => {
      return foreplanCourses;
    },
    useIsPossibleToTakeForeplan: (
      { active },
      { state }: { state: StateCourse | undefined }
    ) => {
      if (active) {
        switch (state) {
          case undefined:
          case StateCourse.Failed:
          case StateCourse.Canceled: {
            return true;
          }
          default:
        }
      }
      return false;
    },
    useForeplanIsFutureCourseRequisitesFulfilled: (
      { futureCourseRequisites },
      { code }: { code: string }
    ) => {
      return (
        !!futureCourseRequisites[code] && every(futureCourseRequisites[code])
      );
    },
  },
});

const rememberForeplanDataKey = "TrAC_foreplan_data";

export const ForeplanContextManager: FC = memo(() => {
  const { program, student, mock, chosenCurriculum } = useDashboardInputState();
  // const [state, { reset, disableForeplan }] = useForeplanActiveData();
  const state = ForeplanActiveStore.useStore();

  const { user } = useUser({
    fetchPolicy: "cache-only",
  });

  const [setRememberForeplan] = useMutation(SET_PERSISTENCE_VALUE, {
    ignoreResults: true,
  });

  const [key, setKey] = useState(
    rememberForeplanDataKey +
      `${chosenCurriculum || ""}${program || ""}${student || ""}${mock ? 1 : 0}`
  );

  useDebounce(
    () => {
      setKey(
        rememberForeplanDataKey +
          `${chosenCurriculum || ""}${program || ""}${student || ""}${
            mock ? 1 : 0
          }`
      );
    },
    500,
    [chosenCurriculum, program, student, mock, setKey]
  );

  const { setIsForeplanLoading } = useIsPersistenceLoading();
  const {
    data: dataRememberForeplan,
    loading: loadingRememberForeplan,
  } = useQuery(GET_PERSISTENCE_VALUE, {
    variables: {
      key,
    },
    notifyOnNetworkStatusChange: true,
    fetchPolicy: "network-only",
  });

  useEffect(() => {
    setIsForeplanLoading(loadingRememberForeplan);
  }, [setIsForeplanLoading, loadingRememberForeplan]);

  useEffect(() => {
    if (!loadingRememberForeplan) {
      if (dataRememberForeplan?.getPersistenceValue) {
        ForeplanActiveStore.actions.reset({
          ...defaultForeplanActiveData,
          ...dataRememberForeplan.getPersistenceValue.data,
        });
      }
    } else {
      ForeplanActiveStore.actions.reset();
    }
  }, [dataRememberForeplan, loadingRememberForeplan]);

  const [, { setTrackingData }] = useTracking();

  useEffect(() => {
    if (!loadingRememberForeplan) {
      const coursesArray = Object.keys(state.foreplanCourses);
      setTrackingData({
        foreplanActive: state.active,
        foreplanCredits: state.active ? state.totalCreditsTaken : undefined,
        foreplanCourses:
          coursesArray.length > 0 ? coursesArray.join("|") : undefined,
      });
    }
  }, [state, setTrackingData, loadingRememberForeplan]);

  useEffect(() => {
    if (state.active && !user?.config.FOREPLAN) {
      ForeplanActiveStore.actions.disableForeplan();
    }
  }, [user, state.active]);

  useDebounce(
    () => {
      if (user?.config.FOREPLAN) {
        setRememberForeplan({
          variables: {
            key,
            data: state,
          },
        });
      }
    },
    1000,
    [key, state, user, setRememberForeplan]
  );

  return null;
});
