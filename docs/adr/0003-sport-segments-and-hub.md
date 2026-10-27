# Sport segments plus a thin hub

**Status:** the segment split stands. How a round is played is decided in [ADR-0004](./0004-session-plugins.md): one session core, and each sport is a plug-in that folds events. This note's "each sport owns a scorecard module" is that earlier cut.

Padel, Golf, and Darts are top-level code segments. Each sport owns its rules (padel scoring when it exists, golf handicap, darts turns). Hub modules stay shared: identity, venues, one session lobby, and social. Play is a session. The sport is a parameter of that session, not a second lifecycle.

We rejected putting sports inside Scorecards/Organise/Competition (ADR-0002) because that hides the real seam: sport rules differ, matching and people do not. We rejected cloning the round per sport: one session already seats every sport; a second scorecard module would fork it.