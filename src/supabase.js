(function () {
  "use strict";

  const supabaseUrl = "https://awoyslrpmbygibyvjnpb.supabase.co";
  const supabaseKey = "sb_publishable_q5d521VBU6AoreWCQZtnFg_JXdTpGEc";
  const stateTable = "labcon_state";
  const stateId = "default";
  const allowedRoles = new Set(["aluno", "professor", "tecnico", "administrador"]);

  const client = window.supabase?.createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true
    }
  });

  function normalizeRole(role) {
    return allowedRoles.has(role) ? role : "aluno";
  }

  function emptyState() {
    return window.LabConConfig?.emptyState
      ? JSON.parse(JSON.stringify(window.LabConConfig.emptyState))
      : { users: [], labs: [], desks: [], reservations: [] };
  }

  function storeKey() {
    return window.LabConConfig?.storeKey ?? "labcon-state-v1";
  }

  function schemaVersion() {
    return window.LabConConfig?.schemaVersion ?? 1;
  }

  window.LabConSupabase = {
    client,
    isReady: Boolean(client),

    async getSession() {
      if (!client) return null;
      const { data, error } = await client.auth.getSession();
      if (error) throw error;
      return data.session;
    },

    async requireSession() {
      const session = await this.getSession();
      if (!session) {
        window.location.replace("login.html");
        return null;
      }
      return session;
    },

    roleFromUser(user) {
      return normalizeRole(user?.app_metadata?.role || user?.user_metadata?.role);
    },

    async updateUserMetadata(metadata) {
      if (!client) return null;
      const { data, error } = await client.auth.updateUser({ data: metadata });
      if (error) throw error;
      return data.user;
    },

    async loadState(fallbackState) {
      if (!client) return fallbackState;
      const { data, error } = await client
        .from(stateTable)
        .select("data")
        .eq("id", stateId)
        .maybeSingle();
      if (error) throw error;
      return data?.data ? { ...fallbackState, ...data.data } : fallbackState;
    },

    async loadStateWithMeta(fallbackState) {
      if (!client) return { data: fallbackState, updatedAt: null };
      const { data, error } = await client
        .from(stateTable)
        .select("data, updated_at")
        .eq("id", stateId)
        .maybeSingle();
      if (error) throw error;
      return {
        data: data?.data ? { ...fallbackState, ...data.data } : fallbackState,
        updatedAt: data?.updated_at || null
      };
    },

    async saveState(state) {
      if (!client) return;
      const session = await this.getSession();
      if (!session) throw new Error("Sessao obrigatoria para gravar dados.");
      const { error } = await client
        .from(stateTable)
        .upsert({ id: stateId, data: state, updated_at: new Date().toISOString() }, { onConflict: "id" });
      if (error) throw error;
    },

    async saveStateAtomic(state, expectedUpdatedAt) {
      if (!client) return null;
      const session = await this.getSession();
      if (!session) throw new Error("Sessao obrigatoria para gravar dados.");

      if (expectedUpdatedAt) {
        try {
          const { data, error } = await client.rpc("labcon_atomic_upsert", {
            p_new_state: state,
            p_expected_updated_at: expectedUpdatedAt
          });
          if (error) throw error;
          if (data && !data.ok) {
            const err = new Error("Conflito de escrita concorrente. Recarregue e tente novamente.");
            err.code = "CONFLICT";
            throw err;
          }
          return (data && data.updated_at) || new Date().toISOString();
        } catch (rpcError) {
          if (rpcError.code === "CONFLICT") throw rpcError;
          console.warn("labcon_atomic_upsert nao disponivel, usando save direto.", rpcError);
        }
      }

      await this.saveState(state);
      return new Date().toISOString();
    },

    async upsertUserFromAuth(authUser) {
      if (!authUser) return null;
      const metadata = authUser.user_metadata || {};
      const role = normalizeRole(metadata.role);
      const user = {
        id: `auth-${authUser.id}`,
        authUserId: authUser.id,
        email: authUser.email,
        name: metadata.name || authUser.email?.split("@")[0] || "Usuario",
        role,
        level: role === "aluno" ? metadata.level || "graduacao" : undefined,
        course: role === "aluno" && metadata.level !== "pos-graduacao" ? metadata.course || "" : undefined,
        program: role === "aluno" && metadata.level !== "pos-graduacao" ? metadata.program || "" : undefined,
        postgradType: role === "aluno" && metadata.level === "pos-graduacao" ? metadata.postgradType || "" : undefined,
        advisorId: role === "aluno" ? metadata.advisorId || "" : "",
        advisorName: role === "aluno" ? metadata.advisorName || "" : "",
        researchProject: role === "aluno" ? metadata.researchProject || "" : "",
        source: "auth"
      };
      const state = await this.loadState(emptyState());
      const users = Array.isArray(state.users) ? state.users : [];
      const index = users.findIndex((entry) => {
        return entry.authUserId === user.authUserId || entry.email === user.email || entry.id === user.id;
      });
      const nextUsers = [...users];
      if (index >= 0) nextUsers[index] = { ...nextUsers[index], ...user };
      else nextUsers.push(user);

      const nextState = { ...emptyState(), ...state, users: nextUsers };
      await this.saveState(nextState);
      localStorage.setItem(storeKey(), JSON.stringify({ ...nextState, _v: schemaVersion() }));
      return user;
    }
  };
}());
