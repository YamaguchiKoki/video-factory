#!/usr/bin/env node
import * as cdk from "aws-cdk-lib/core";
import { createEcrStack } from "../lib/ecr-stack";
import { createVideoFactoryStack } from "../lib/video-factory-stack";

const app = new cdk.App();

const { stack: ecrStack, repositories } = createEcrStack(app);
const videoFactoryStack = createVideoFactoryStack(app, { repositories });

videoFactoryStack.addDependency(ecrStack);
