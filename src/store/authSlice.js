import { createSlice } from "@reduxjs/toolkit";
import { api, getToken, setToken } from "../services/api";
import { clearJson, loadJson, saveJson } from "../services/storage";
import { setDirectory } from "./directorySlice";
import { setMaterialRequests, setSuppliers } from "./workflowSlice";

const STORAGE_KEY = "servhub_auth_v5";

function loadAuth() {
  return loadJson(STORAGE_KEY);
}

const saved = loadAuth();

const initialState = {
  user: saved?.user || null,
  role: saved?.role || null,
  privileges: saved?.privileges || {},
  /** Company/tenant of the signed-in user (null for platform admins). UX only; the API enforces access. */
  company: saved?.company || null,
  features: saved?.features || [],
  permissionCatalog: saved?.permissionCatalog || {},
  scope: saved?.scope || null,
  error: null,
  loading: false,
};

function persist(state) {
  saveJson(STORAGE_KEY, {
    user: state.user,
    role: state.role,
    privileges: state.privileges,
    company: state.company,
    features: state.features,
    permissionCatalog: state.permissionCatalog,
    scope: state.scope,
  });
}

function applySession(state, payload) {
  state.user = payload.user;
  state.role = payload.role;
  state.privileges = payload.privileges || {};
  state.company = payload.company || null;
  state.features = payload.features || [];
  state.permissionCatalog = payload.permissionCatalog || {};
  state.scope = payload.scope || null;
  state.error = null;
  persist(state);
}

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    sessionStart(state) {
      state.loading = true;
      state.error = null;
    },
    loginSuccess(state, action) {
      state.loading = false;
      applySession(state, action.payload);
    },
    loginFailed(state, action) {
      state.loading = false;
      state.error = action.payload || "Invalid email or password";
    },
    logout(state) {
      state.user = null;
      state.role = null;
      state.privileges = {};
      state.company = null;
      state.features = [];
      state.permissionCatalog = {};
      state.scope = null;
      state.error = null;
      state.loading = false;
      setToken("");
      clearJson(STORAGE_KEY);
    },
    setCompany(state, action) {
      state.company = action.payload || null;
      persist(state);
    },
    clearError(state) {
      state.error = null;
    },
  },
});

export const { sessionStart, loginSuccess, loginFailed, logout, setCompany, clearError } = authSlice.actions;

function applyDirectory(dispatch, directory) {
  if (directory) dispatch(setDirectory(directory));
}

export const signOut = () => (dispatch) => {
  dispatch(logout());
  dispatch(
    setDirectory({
      users: [],
      roles: [],
      departments: [],
      projects: [],
      rolePrivileges: {},
      departmentPrivileges: {},
    })
  );
  dispatch(setMaterialRequests([]));
  dispatch(setSuppliers([]));
};

export const login = ({ email, password }) => async (dispatch) => {
  dispatch(sessionStart());
  try {
    const data = await api.post("/auth/login", { email, password });
    setToken(data.token);
    dispatch(loginSuccess(data));
    applyDirectory(dispatch, data.directory);
  } catch (error) {
    dispatch(loginFailed(error.message));
  }
};

export const restoreSession = () => async (dispatch) => {
  if (!getToken()) return;
  try {
    const data = await api.get("/auth/me");
    dispatch(loginSuccess(data));
    applyDirectory(dispatch, data.directory);
  } catch {
    dispatch(signOut());
  }
};

export const syncCurrentUser = () => async (dispatch) => {
  if (!getToken()) return;
  try {
    const data = await api.get("/auth/me");
    dispatch(loginSuccess(data));
    applyDirectory(dispatch, data.directory);
  } catch {
    dispatch(signOut());
  }
};

export const refreshDirectory = () => async (dispatch, getState) => {
  if (getState().auth.user?.isPlatformAdmin) return null;
  const data = await api.get("/auth/directory");
  applyDirectory(dispatch, data);
  return data;
};

export default authSlice.reducer;
