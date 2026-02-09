
from pydantic import BaseModel
from typing import Any, Callable, NamedTuple


############################## Models ##############################


class Vector3(NamedTuple):
    x: float
    y: float
    z: float


class StateManagerModel(BaseModel):
    consumed: Any
    produced: Any
    function: Callable


############################## DTOs ##############################


class AgentStateDTO(BaseModel):
    position: Vector3
    velocity: Vector3
    mass: float


class StateManagerDTO(BaseModel):
    consumed: str
    produced: str
    function: str


class AgentDTO(BaseModel):
    id: str
    state_managers: list[StateManagerDTO]


class ActorProfileDTO(BaseModel):
    agents: list[AgentDTO]


class SimulationDTO(BaseModel):
    initial_states: dict[str, AgentStateDTO]
