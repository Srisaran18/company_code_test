import { configureStore } from "@reduxjs/toolkit";
import authReducer from "./authSlice";
import directoryReducer from "./directorySlice";

import workflowReducer from "./workflowSlice";

const store = configureStore({
  reducer: {
    auth: authReducer,
    directory: directoryReducer,
    workflow: workflowReducer,
  },
});

export default store;
