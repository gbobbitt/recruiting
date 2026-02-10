import { Button, Flex, Card, Heading, Separator, Table, TextField } from '@radix-ui/themes';
import * as ScrollArea from '@radix-ui/react-scroll-area';
import * as Select from '@radix-ui/react-select';
import * as Form from '@radix-ui/react-form';
import * as Label from '@radix-ui/react-label';
import { createContext, forwardRef, useCallback, useContext, useEffect, useRef, useState } from 'react';
import Plot from 'react-plotly.js';
import { Link } from 'react-router-dom';
import { Routes } from 'routes';
import _ from 'lodash';

// Profile data
type StateManagerFormData = {
  function: string;
  consumed: string;
  produced: string;
};

type AgentFormData = {
  id: string;
  state_managers: StateManagerFormData[];
}

type AgentInitialStateFormData = {
  position: {
    x: number;
    y: number;
    z: number;
  };
  velocity: {
    x: number;
    y: number;
    z: number;
  };
  mass: number;
};

type ProfileFormData = {
  agents: AgentFormData[];
}

type StateManagerSchema = {
  function_name: string;
  inputs: Record<string, string>[];
  output_type: string;
}

// Input data from the simulation
type AgentData = Record<string, Record<string, number>>;
type DataFrame = Record<string, AgentData>;
type DataPoint = [number, number, DataFrame];

type SimulationFormData = {
  initial_states: Record<string, AgentInitialStateFormData>;
  data: DataPoint[];
}

// Output data to the plot
type PlottedAgentData = Record<string, number[]>;
type PlottedFrame = Record<string, PlottedAgentData>;

const StateManagerSchemaContext = createContext<StateManagerSchema[]>([]);

const App = () => {
  const [profiles, setProfiles] = useState<Record<string, ProfileFormData>>({});
  const [selectedProfile, setSelectedProfile] = useState<string | null>(null);
  const [makingNewProfile, setMakingNewProfile] = useState<boolean>(false);
  
  const [simulations, setSimulations] = useState<Record<string, SimulationFormData>>({});
  const [selectedSimulation, setSelectedSimulation] = useState<string | null>(null);

  const [stateManagerSchema, setStateManagerSchema] = useState<StateManagerSchema[]>([]);

  
  const handleProfileFormSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();

    async function saveProfile() {
      try {
        if (!selectedProfile) {
          throw new Error('No profile selected');
        }

        const response = await fetch(`http://localhost:8000/profile/${selectedProfile}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(profiles[selectedProfile]),
        });
        if (!response.ok) {
          throw new Error(`Failed to save profile: ${response.status}`);
        }
        console.log('Profile saved successfully');
      } catch (error) {
        console.error('Error saving profile:', error);
      }
    }

    saveProfile();
  }, [selectedProfile, profiles]);

  const onProfileChange = useCallback((profileId: string) => {
    if (profileId === "new") {
      setMakingNewProfile(true);

      var newProfile: ProfileFormData = {
        agents: [],
      };
      const newProfileId = `Profile ${Object.keys(profiles).length + 1}`;
      setProfiles({...profiles, [newProfileId]: newProfile});
      setSelectedProfile(newProfileId);

      return;
    }

    async function loadProfile() {
      try {
        const response = await fetch(`http://localhost:8000/profile/${profileId}/load`, {
          method: 'POST',
        });
        if (!response.ok) {
          throw new Error(`Failed to load profile: ${response.status}`);
        }
        setSelectedProfile(profileId);
      } catch (error) {
        console.error('Error loading profile:', error);
      }
    }

    // Fetch simulations for the selected profile
    async function fetchSimulations() {
      try {
        const response = await fetch(`http://localhost:8000/profile/${profileId}/simulations`);
        if (!response.ok) {
          throw new Error(`Failed to fetch simulations: ${response.status}`);
        }
        const data: Record<string, SimulationFormData> = await response.json();
        setSimulations(data);
        console.log('Simulations:', data);
      } catch (error) {
        console.error('Error fetching simulations:', error);
      }
    }
    
    loadProfile();
    fetchSimulations();
  }, [profiles]);

  useEffect(() => {
    // fetch functions when the component mounts
    let canceled = false;

    async function fetchStateManagers() {
      try {
        const response = await fetch('http://localhost:8000/schema/statemanagers');
        if (canceled) return;
        const data = await response.json();
        console.log('State manager schema:', data);
        setStateManagerSchema(data.state_managers);
      } catch (error) {
        console.error('Error fetching state managers:', error);
      }
    }

    fetchStateManagers();

    return () => {
      canceled = true;
    };
  }, []);

  useEffect(() => {
    // fetch profiles when the component mounts
    let canceled = false;

    async function fetchProfiles() {
      try {
        const response = await fetch('http://localhost:8000/profiles');
        if (canceled) return;
        const data: Record<string, ProfileFormData> = await response.json();
        setProfiles(data);
        console.log('Profiles:', data);
      } catch (error) {
        console.error('Error fetching profiles:', error);
      }
    }

    fetchProfiles();

    return () => {
      canceled = true;
    };
  }, []);

  // Store plot data in state.
  const [positionData, setPositionData] = useState<PlottedAgentData[]>([]);
  const [velocityData, setVelocityData] = useState<PlottedAgentData[]>([]);
  const [initialState, setInitialState] = useState<DataFrame>({});

  useEffect(() => {
    // fetch plot data when the component mounts
    let canceled = false;

    async function fetchSimulation() {
      try {
        // data should be populated from a POST call to the simulation server
        const response = await fetch(`http://localhost:8000/profile/${selectedProfile}/simulation/${selectedSimulation}`);
        if (canceled) return;
        const data: DataPoint[] = await response.json();
        const updatedPositionData: PlottedFrame = {};
        const updatedVelocityData: PlottedFrame = {};

        // NOTE: Uncomment to see the raw data in the console
        console.log('Data:', data);

        setInitialState(data[0][2]);

        const baseData = () => ({
          x: [],
          y: [],
          z: [],
          type: 'scatter3d',
          mode: 'lines+markers',
          marker: { size: 4 },
          line: { width: 2 },
        });

        data.forEach(([t0, t1, frame]) => {
          for (let [agentId, val] of Object.entries(frame)) {
              if (agentId == "time" || agentId == "timeStep") {
                continue;
              }
              let {position, velocity} = val;
              updatedPositionData[agentId] = updatedPositionData[agentId] || baseData();
              updatedPositionData[agentId].x.push(position.x);
              updatedPositionData[agentId].y.push(position.y);
              updatedPositionData[agentId].z.push(position.z);

              updatedVelocityData[agentId] = updatedVelocityData[agentId] || baseData();
              updatedVelocityData[agentId].x.push(velocity.x);
              updatedVelocityData[agentId].y.push(velocity.y);
              updatedVelocityData[agentId].z.push(velocity.z);
          }
        });
        setPositionData(Object.values(updatedPositionData));
        setVelocityData(Object.values(updatedVelocityData));
        console.log('Set plot data!');
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    }

    if (selectedSimulation) {
      fetchSimulation();
    }

    return () => {
      canceled = true;
    };
  }, [selectedSimulation]);

  return (
    <div
      style={{
        height: '100vh',
        width: '100vw',
        margin: '0 auto',
      }}
    >
      {/* Flex: https://www.radix-ui.com/themes/docs/components/flex */}
      <Flex direction="column" m="4" width="100%" justify="center" align="center">
        <Heading as="h1" size="8" weight="bold" mb="4">
          Sedaro Nano Simulator
        </Heading>
        <Flex direction="row" width="100%" justify="center" mb="4" align="start">

          <Flex direction="column" mr="4" align="start" gap="2" style={{width: "500px"}}>
            <Select.Root onValueChange={onProfileChange}>
              <Select.Trigger>
                <Select.Value placeholder="Select a profile" />
                <Select.Icon />
              </Select.Trigger>
              <Select.Portal>
                <Select.Content position='popper' style={{
                  backgroundColor: '#000000',
                  zIndex: 999999,
                  borderRadius: 6,
                  boxShadow: '0 6px 18px rgba(0,0,0,0.12)',
                  padding: 6,
                }}>
                  <Select.Viewport>
                    <Select.Item value="new">
                      <Select.ItemText>
                          New profile
                      </Select.ItemText>
                    </Select.Item>
                    {Object.keys(profiles).map((id) => (
                      <Select.Item key={id} value={id}>
                        <Select.ItemText>{id}</Select.ItemText>
                      </Select.Item>
                    ))}
                  </Select.Viewport>
                </Select.Content>
              </Select.Portal>
            </Select.Root>
            
            <StateManagerSchemaContext.Provider value={stateManagerSchema}>
              {/* List all agents for the selected profile */}
              {selectedProfile && profiles[selectedProfile] && (
                <ScrollArea.Root style={{height: '100%', width: '100%'}}>
                  <ScrollArea.Viewport>
                    <Form.Root onSubmit={handleProfileFormSubmit}>
                      <ProfilesForm makingNewProfile={makingNewProfile} profileId={selectedProfile} profileData={profiles[selectedProfile]} updatedProfile={(updatedProfile, profileId) => {
                        const updatedProfiles = {...profiles};
                        updatedProfiles[profileId] = updatedProfile;
                        if (selectedProfile !== profileId) {
                          delete updatedProfiles[selectedProfile];
                          setSelectedProfile(profileId);
                        }

                        setProfiles(updatedProfiles);

                        // Update simulations with new agents from the profile
                        const updatedSims = {...simulations};
                        for (let simId in updatedSims) {
                          const sim = updatedSims[simId];
                          for (let agent of updatedProfile.agents) {
                            if (!sim.initial_states[agent.id]) {
                              sim.initial_states[agent.id] = {
                                position: {x: 0, y: 0, z: 0},
                                velocity: {x: 0, y: 0, z: 0},
                                mass: 1,
                              };
                            }
                          }
                        }
                        setSimulations(updatedSims);
                      }} />
                    </Form.Root>
                  </ScrollArea.Viewport>
                </ScrollArea.Root>
              )}
            </StateManagerSchemaContext.Provider>
          </Flex>
          
          {/* List all simulations for the selected profile */}
          {selectedProfile && profiles[selectedProfile] && (
            <ScrollArea.Root style={{height: '100%', width: '500px'}}>
              <ScrollArea.Viewport>
                <Form.Root onSubmit={handleProfileFormSubmit}>
                  <SimulationsForm profileId={selectedProfile} profile={profiles[selectedProfile]} simulations={simulations} 
                    updatedSimulations={(updatedSimulations) => {
                      setSimulations(updatedSimulations);
                    }}

                    gotSimulationResults={(updatedPositionData, updatedVelocityData) => {
                      setPositionData(Object.values(updatedPositionData));
                      setVelocityData(Object.values(updatedVelocityData));
                    }}
                  />
                </Form.Root>
              </ScrollArea.Viewport>
            </ScrollArea.Root>
          )}

          <Flex direction="column" style={{ flex: 1, minWidth: 0 }} align="stretch">
            <Plot
              style={{ width: '100%', height: '100%', margin: '5px' }}
              data={positionData}
              layout={{
                title: 'Position',
                scene: {
                  xaxis: { title: 'X' },
                  yaxis: { title: 'Y' },
                  zaxis: { title: 'Z' },
                },
                autosize: true,
                dragmode: 'turntable',
              }}
              useResizeHandler
              config={{
                scrollZoom: true,
              }}
            />
            <Plot
              style={{ width: '100%', height: '100%', margin: '5px' }}
              data={velocityData}
              layout={{
                title: 'Velocity',
                scene: {
                  xaxis: { title: 'X' },
                  yaxis: { title: 'Y' },
                  zaxis: { title: 'Z' },
                },
                autosize: true,
                dragmode: 'turntable',
              }}
              useResizeHandler
              config={{
                scrollZoom: true,
              }}
            />
          </Flex>
        </Flex>
      </Flex>
    </div>
  );
};


const ProfilesForm = forwardRef(
    ({profileId, profileData, updatedProfile, makingNewProfile, ...props}: {profileId: string, profileData: ProfileFormData, updatedProfile: (updatedProfile: ProfileFormData, profileId: string) => void, makingNewProfile: boolean}, ref: any) => {

  return (
    <Card ref={ref} {...props}>
      <Form.Field name="id" style={{margin: "10px"}}>
        <Form.Label>Profile Name</Form.Label>
        <TextField.Root
          type="text"
          id="id"
          name="id"
          value={profileId}
          onChange={(e) => updatedProfile({...profileData}, e.target.value)}
          disabled={!makingNewProfile}
          required
        />
      </Form.Field>
      {profileData.agents.map((actor, index) => (
        <ActorForm key={actor.id} actor={actor} style={{margin: "10px"}}
          updatedActor={(updatedActor) => {
            const updatedActors = [...profileData.agents];
            updatedActors[index] = updatedActor;
            updatedProfile({...profileData, agents: updatedActors}, profileId);
          }} />
      ))}
      <Button type="button" onClick={() => {
        const newAgent: AgentFormData = {
          id: `Body${profileData.agents.length + 1}`,
          state_managers: [],
        };
        updatedProfile({...profileData, agents: [...profileData.agents, newAgent]}, profileId);
      }}>
        Add Agent
      </Button>
      <Form.Submit asChild>
        <Button>Save</Button>
      </Form.Submit>
    </Card>
  );
});


const ActorForm = forwardRef(
    ({actor, updatedActor, ...props}: {actor: AgentFormData, updatedActor: (updatedActor: AgentFormData) => void}, ref: any) => {

  return (
    <Card ref={ref} {...props}>
      <Form.Field name={`${actor.id}`} style={{margin: "10px"}}>
        <Form.Label>{actor.id}</Form.Label>
      </Form.Field>
      {actor.state_managers.map((sm, index) => (
        <StateManagerForm key={`${actor.id}-${index}`} index={`${actor.id}-${index}`} sm={sm} style={{margin: "10px"}}
          updatedStateManager={(updatedSM) => {
            const updatedSMs = [...actor.state_managers];
            updatedSMs[index] = updatedSM;
            updatedActor({...actor, state_managers: updatedSMs});
          }} />
      ))}
      <Button type="button" onClick={() => {
        const newSM: StateManagerFormData = {
          function: '',
          consumed: '',
          produced: '',
        };
        actor.state_managers.push(newSM);
        updatedActor({...actor});
      }}>
        Add State Manager
      </Button>
    </Card>
  );
});


const StateManagerForm = forwardRef(
    ({index, sm, updatedStateManager, ...props}: {index: string, sm: StateManagerFormData, updatedStateManager: (updatedSM: StateManagerFormData) => void}, ref: any) => {

  const stateManagerSchema = useContext(StateManagerSchemaContext);
  const consumedRegex = RegExp(/^\((.*),\)$/);

  function setFunction(funcName: string) {
    const updatedSM = {...sm, function: funcName};
    updatedStateManager(updatedSM);
  }

  function getConsumedParts() {
    const consumedStr = sm.consumed.trim();
    const inner = consumedRegex.exec(consumedStr);
    if (inner && inner[1]) {
      return inner[1].split(',').map(s => s.trim());
    }

    return [];
  }

  function getConsumedPart(index: number) {
    const consumedParts = getConsumedParts();
    return consumedParts[index] || '';
  }

  function setConsumedPart(consumed: string, index: number) {
    const consumedParts = getConsumedParts();
    consumedParts[index] = consumed;
    const updatedConsumed = `(${consumedParts.join(', ')},)`;
    const updatedSM = {...sm, consumed: updatedConsumed};
    updatedStateManager(updatedSM);
  }

  function setProduced(produced: string) {
    const updatedSM = {...sm, produced};
    updatedStateManager(updatedSM);
  }

  return (
    <Card ref={ref} {...props}>
      <Form.Field name={`stateManager-${index}-function`} style={{margin: "10px"}}>
        <Form.Control asChild>
          <Select.Root onValueChange={setFunction}>
            <Select.Trigger>
              <Select.Value placeholder="Select a function" />
              <Select.Icon />
            </Select.Trigger>
            <Select.Portal>
              <Select.Content position='popper' style={{
                backgroundColor: '#000000',
                zIndex: 999999,
                borderRadius: 6,
                boxShadow: '0 6px 18px rgba(0,0,0,0.12)',
                padding: 6,
              }}>
                <Select.Viewport>
                  {stateManagerSchema.map((schema) => (
                    <Select.Item key={`${schema.function_name}-${index}`} value={schema.function_name}>
                      <Select.ItemText>{schema.function_name}</Select.ItemText>
                    </Select.Item>
                  ))}
                </Select.Viewport>
              </Select.Content>
            </Select.Portal>
          </Select.Root>
        </Form.Control>
      </Form.Field>

      {/* Expose `consumed` tuple as individual fields */}
      {stateManagerSchema.find((schema) => schema.function_name === sm.function)?.inputs.map((input, inputIndex) => (
        <Form.Field key={`${index}-input-${inputIndex}`} name={`stateManager-${index}-input-${inputIndex}`} style={{margin: "10px"}}>
          <Form.Label>{Object.keys(input)[0]} <i>{input[Object.values(input)[0]]}</i></Form.Label>
          <Form.Control asChild>
            <TextField.Root
              name={`stateManager-${index}-input-${inputIndex}`}
              defaultValue={getConsumedPart(inputIndex)}
              onChange={(e) => setConsumedPart(e.target.value, inputIndex)}
            />
          </Form.Control>
        </Form.Field>
      ))}

      {stateManagerSchema.find((schema) => schema.function_name === sm.function) && (
        <Form.Field name={`stateManager-produced-${index}`}>
          <Form.Label>Produced</Form.Label>
          <Form.Control asChild>
            <TextField.Root
              name={`stateManager-produced-${index}`}
              defaultValue={sm.produced}
              onChange={(e) => setProduced(e.target.value)}
            />
          </Form.Control>
        </Form.Field>
      )}
    </Card>
  );
});


const SimulationsForm = forwardRef(
    ({profileId, profile, simulations, updatedSimulations, gotSimulationResults, ...props}: {profileId: string, profile: ProfileFormData, simulations: Record<string, SimulationFormData>, updatedSimulations: (updatedSimulations: Record<string, SimulationFormData>) => void, gotSimulationResults: (positionData: PlottedFrame, velocityData: PlottedFrame) => void}, ref: any) => {
  
  function runSimulation(simulationId: string, simulation: SimulationFormData) {
    async function run() {
      try {
        const response = await fetch(`http://localhost:8000/profile/${profileId}/simulation/${simulationId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(simulation),
        });
        if (!response.ok) {
          throw new Error(`Failed to run simulation: ${response.status}`);
        }
        console.log('Simulation run successfully');

        const data: DataPoint[] = await response.json();
        const updatedPositionData: PlottedFrame = {};
        const updatedVelocityData: PlottedFrame = {};

        // NOTE: Uncomment to see the raw data in the console
        console.log('Data:', data);

        const baseData = () => ({
          x: [],
          y: [],
          z: [],
          type: 'scatter3d',
          mode: 'lines+markers',
          marker: { size: 4 },
          line: { width: 2 },
        });

        data.forEach(([t0, t1, frame]) => {
          for (let [agentId, val] of Object.entries(frame)) {
              if (agentId == "time" || agentId == "timeStep") {
                continue;
              }
              let {position, velocity} = val;
              updatedPositionData[agentId] = updatedPositionData[agentId] || baseData();
              updatedPositionData[agentId].x.push(position.x);
              updatedPositionData[agentId].y.push(position.y);
              updatedPositionData[agentId].z.push(position.z);

              updatedVelocityData[agentId] = updatedVelocityData[agentId] || baseData();
              updatedVelocityData[agentId].x.push(velocity.x);
              updatedVelocityData[agentId].y.push(velocity.y);
              updatedVelocityData[agentId].z.push(velocity.z);
          }
        });

        gotSimulationResults(updatedPositionData, updatedVelocityData);
      } catch (error) {
        console.error('Error running simulation:', error);
      }
    }

    run();
  }
  
  return (
    <Card ref={ref} {...props}>
      {Object.entries(simulations).map(([simulationId, simulation]) => (
        <Card>
          <Heading as="h2" size="5" weight="bold" mb="2">
            {simulationId}
          </Heading>
          <Button type="button" onClick={() => runSimulation(simulationId, simulation) }>
            Run Simulation
          </Button>
          { /* Add input fields for each initial state */}
          {Object.entries(simulation.initial_states).map(([agentId, initialState]) => (
            <Card key={`${simulationId}-${agentId}`} style={{margin: "10px"}}>
              <Heading as="h3" size="3" weight="bold">
                {agentId}
              </Heading>
              <Flex direction="row" align="center" gap="2">
                <Label.Root>Initial Position</Label.Root>
                <Form.Field name={`initial_state_${agentId}_position_x`}>
                  <Form.Label htmlFor={`initial_state_${agentId}_position_x`}>X</Form.Label>
                  <TextField.Root
                    type="number"
                    id={`initial_state_${agentId}_position_x`}
                    name={`initial_state_${agentId}_position_x`}
                    value={initialState.position.x}
                    onChange={(e) => {
                      const updatedSim = {...simulation};
                      updatedSim.initial_states[agentId].position.x = parseFloat(e.target.value);
                      updatedSimulations({...simulations, [simulationId]: updatedSim});
                    }}
                    required
                  />
                </Form.Field>
                <Form.Field name={`initial_state_${agentId}_position_y`}>
                  <Form.Label htmlFor={`initial_state_${agentId}_position_y`}>Y</Form.Label>
                  <TextField.Root
                    type="number"
                    id={`initial_state_${agentId}_position_y`}
                    name={`initial_state_${agentId}_position_y`}
                    value={initialState.position.y}
                    onChange={(e) => {
                      const updatedSim = {...simulation};
                      updatedSim.initial_states[agentId].position.y = parseFloat(e.target.value);
                      updatedSimulations({...simulations, [simulationId]: updatedSim});
                    }}
                    required
                  />
                </Form.Field>
                <Form.Field name={`initial_state_${agentId}_position_z`}>
                  <Form.Label htmlFor={`initial_state_${agentId}_position_z`}>Z</Form.Label>
                  <TextField.Root
                    type="number"
                    id={`initial_state_${agentId}_position_z`}
                    name={`initial_state_${agentId}_position_z`}
                    value={initialState.position.z}
                    onChange={(e) => {
                      const updatedSim = {...simulation};
                      updatedSim.initial_states[agentId].position.z = parseFloat(e.target.value);
                      updatedSimulations({...simulations, [simulationId]: updatedSim});
                    }}
                    required
                  />
                </Form.Field>
              </Flex>
              <Flex direction="row" align="center" gap="2">
                <Label.Root>Initial Velocity</Label.Root>
                <Form.Field name={`initial_state_${agentId}_velocity_x`}>
                  <Form.Label htmlFor={`initial_state_${agentId}_velocity_x`}>X</Form.Label>
                  <TextField.Root
                    type="number"
                    id={`initial_state_${agentId}_velocity_x`}
                    name={`initial_state_${agentId}_velocity_x`}
                    value={initialState.velocity.x}
                    onChange={(e) => {
                      const updatedSim = {...simulation};
                      updatedSim.initial_states[agentId].velocity.x = parseFloat(e.target.value);
                      updatedSimulations({...simulations, [simulationId]: updatedSim});
                    }}
                    required
                  />
                </Form.Field>
                <Form.Field name={`initial_state_${agentId}_velocity_y`}>
                  <Form.Label htmlFor={`initial_state_${agentId}_velocity_y`}>Y</Form.Label>
                  <TextField.Root
                    type="number"
                    id={`initial_state_${agentId}_velocity_y`}
                    name={`initial_state_${agentId}_velocity_y`}
                    value={initialState.velocity.y}
                    onChange={(e) => {
                      const updatedSim = {...simulation};
                      updatedSim.initial_states[agentId].velocity.y = parseFloat(e.target.value);
                      updatedSimulations({...simulations, [simulationId]: updatedSim});
                    }}
                    required
                  />
                </Form.Field>
                <Form.Field name={`initial_state_${agentId}_velocity_z`}>
                  <Form.Label htmlFor={`initial_state_${agentId}_velocity_z`}>Z</Form.Label>
                  <TextField.Root
                    type="number"
                    id={`initial_state_${agentId}_velocity_z`}
                    name={`initial_state_${agentId}_velocity_z`}
                    value={initialState.velocity.z}
                    onChange={(e) => {
                      const updatedSim = {...simulation};
                      updatedSim.initial_states[agentId].velocity.z = parseFloat(e.target.value);
                      updatedSimulations({...simulations, [simulationId]: updatedSim});
                    }}
                    required
                  />
                </Form.Field> 
              </Flex>
              <Form.Field name={`initial_state_${agentId}_mass`}>
                <Form.Label htmlFor={`initial_state_${agentId}_mass`}>Initial Mass</Form.Label>
                <TextField.Root
                  type="number"
                  id={`initial_state_${agentId}_mass`}
                  name={`initial_state_${agentId}_mass`}
                  value={initialState.mass}
                  onChange={(e) => {
                    const updatedSim = {...simulation};
                    updatedSim.initial_states[agentId].mass = parseFloat(e.target.value);
                    updatedSimulations({...simulations, [simulationId]: updatedSim});
                  }}
                  required
                />
              </Form.Field> 
            </Card>
          ))}
        </Card>
      ))}
      <Button type="button" onClick={() => {
        const newSimId = `Simulation ${Object.keys(simulations).length + 1}`;
        const newSim: SimulationFormData = {
          initial_states: profile.agents.reduce((acc, agent) => {
            acc[agent.id] = {
              position: {x: 0, y: 0, z: 0},
              velocity: {x: 0, y: 0, z: 0},
              mass: 1,
            };
            return acc;
          }, {} as Record<string, AgentInitialStateFormData>),
          data: [],
        };
        updatedSimulations({...simulations, [newSimId]: newSim});
      }}>
        Add Simulation
      </Button>
    </Card>
  );
});


export default App;
