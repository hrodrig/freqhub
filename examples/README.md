/*
 * FreqHub - Multi-bot dashboard for Freqtrade
 * Copyright (C) 2025  FreqHub Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

# Deployment Examples

This directory contains examples of how to deploy multiple Freqtrade instances to be managed by FreqHub.

## Directories

### `docker/`
Docker Compose examples for running multiple Freqtrade instances locally or on servers.

**Typical use:**
- Local development
- Small servers
- Testing
- Quick prototyping

**Advantages:**
- Easy to configure
- No Kubernetes required
- Ideal for development

### `kubernetes/`
Kubernetes manifest examples for deploying multiple Freqtrade instances in a cluster.

**Typical use:**
- Production
- Scalability
- High availability
- Advanced orchestration

**Advantages:**
- Scalable
- Auto-recovery
- Resource management
- Integration with K8s ecosystem

## Comparison

| Feature | Docker Compose | Kubernetes |
|---------|----------------|------------|
| Complexity | Low | Medium-High |
| Scalability | Manual | Automatic |
| Auto-recovery | Basic | Advanced |
| Resource management | Manual | Automatic |
| Ideal for | Development/Testing | Production |
| Requirements | Docker, Docker Compose | K8s Cluster |

## Recommendation

- **Development/Testing**: Use `docker/`
- **Production**: Use `kubernetes/`

## Next Steps

1. Choose the deployment method according to your needs
2. Follow the instructions in the corresponding README
3. Connect the instances to FreqHub using the provided URLs
4. Enjoy managing multiple bots from a single place!

## Support

For more information, see:
- [FreqHub README](../README.md)
- [Freqtrade Documentation](https://www.freqtrade.io/)
