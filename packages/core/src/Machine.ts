import {
  MachineConfig,
  EventObject,
  MachineContext,
  InternalMachineImplementations,
  ParameterizedObject,
  ActorImpl,
  AnyEventObject
} from './types.ts';
import {
  TypegenConstraint,
  TypegenDisabled,
  ResolveTypegenMeta
} from './typegenTypes.ts';
import { StateMachine } from './StateMachine.ts';

export function createMachine<
  TContext extends MachineContext,
  TEvent extends EventObject = AnyEventObject,
  TActors extends ActorImpl = ActorImpl,
  TInput = any,
  TTypesMeta extends TypegenConstraint = TypegenDisabled
>(
  config: MachineConfig<
    TContext,
    TEvent,
    ParameterizedObject,
    TActors,
    TInput,
    TTypesMeta
  >,
  implementations?: InternalMachineImplementations<
    TContext,
    TEvent,
    ParameterizedObject,
    TActors,
    ResolveTypegenMeta<TTypesMeta, TEvent, ParameterizedObject, TActors>
  >
): StateMachine<
  TContext,
  TEvent,
  ParameterizedObject,
  TActors,
  TInput,
  ResolveTypegenMeta<TTypesMeta, TEvent, ParameterizedObject, TActors>
> {
  return new StateMachine<any, any, any, any, any, any>(
    config as any,
    implementations as any
  );
}
