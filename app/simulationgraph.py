
import subprocess
import json

import modsim
from models import AgentDTO, StateManagerModel, Vector3


def parse_query(query):
    # NOTE: The query parser is invoked via a subprocess call to the Rust binary
    popen = subprocess.Popen('../queries/target/release/sedaro-nano-queries', stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    (stdout, stderr) = popen.communicate(query)
    if popen.returncode:
        raise Exception(f"Parsing query failed: {stderr}")
    return json.loads(stdout)


class SimulationGraph:
    """
    Build a simulation graph from a list of actors.
    """

    def __init__(self, actors: list[AgentDTO]):
        self._sim_graph: dict[str, list[StateManagerModel]] = {}
        for actor in actors:
            agent: list[StateManagerModel] = []
            for sm in actor.state_managers:
                consumed = parse_query(sm.consumed)["content"]
                produced = parse_query(sm.produced)
                # TODO: validate that the function exists
                func = getattr(modsim, sm.function)
                agent.append(StateManagerModel(function=func, consumed=consumed, produced=produced))
            self._sim_graph[actor.id] = agent

    def step(self, agentId, universe: dict):
        """Run an Agent for a single step."""
        state = dict()
        sms: list[tuple[str, StateManagerModel]] = []
        for sm in self._sim_graph[agentId]:
            sms.append((agentId, sm))
        while sms:
            next_sms = []
            for (agentId, sm) in sms:
                if self.run_sm(agentId, sm, universe, state) is None:
                    next_sms.append((agentId, sm))
            if len(sms) == len(next_sms):
                raise Exception(f"No progress made while evaluating statemanagers for agent {agentId}. Remaining statemanagers: {[sm.function.__name__ for (agentId, sm) in sms]}")
            sms = next_sms
        return state

    def run_sm(self, agentId, sm: StateManagerModel, universe: dict, newState: dict):
        """Run a State Manager for a single step."""
        inputs = []
        for q in sm.consumed:
            found = self.find(agentId, q, universe, newState)
            if found is None:
                return None
            inputs.append(found)
        res = sm.function(*inputs)
        self.put(agentId, sm.produced, universe, newState, res)
        return res

    def find(self, agentId, query, universe: dict, newState: dict, prev=False):
        """Find consumed data to pass to a State Manager."""
        # NOTE: queries are interpreted at runtime here
        match query["kind"]:
            case "Base":
                if prev:
                    return universe[agentId][query["content"]]
                agentState = newState.get(agentId)
                if agentState is None:
                    return None
                return agentState.get(query["content"])
            case "Prev":
                return self.find(agentId, query["content"], universe, newState, prev=True)
            case "Root":
                if prev:
                    return universe[agentId]
                return newState
            case "Agent":
                # agent always gets the previous state
                return universe[query["content"]]
            case "Access":
                base = self.find(agentId, query["content"]["base"], universe, newState, prev)
                if base is None:
                    return None
                return base.get(query["content"]["field"])
            case "Tuple":
                res = []
                for q in query["content"]:
                    found = self.find(agentId, q, universe, newState, prev)
                    if found is None:
                        return None
                    res.append(found)
                return res
            case _:
                return None

    def put(self, agentId, query, universe: dict, newState: dict, data):
        """Put produced data into the universe."""
        match query["kind"]:
            case "Base":
                agentState = newState.get(agentId)
                if agentState is None:
                    agentState = {}
                    newState[agentId] = agentState
                agentState[query["content"]] = data
            case "Prev":
                raise Exception(f"Cannot produce prev query {query}")
            case "Root":
                pass
            case "Agent":
                res = universe[query["content"]]
                if res is None:
                    res = {}
                    universe[query["content"]] = res
                return res
            case "Access":
                baseQuery = query["content"]["base"]
                base = self.find(agentId, baseQuery, universe, newState)
                if base is None:
                    base = {}
                    self.put(agentId, baseQuery, universe, newState, base)
                base[query["content"]["field"]] = data
            case "Tuple":
                raise Exception(f"Tuple production not yet implemented")
