/*
 * FreqHub - Multi-bot dashboard for Freqtrade
 * Copyright (C) 2025 - 2026  FreqHub Contributors
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

## ⚖️ Disclaimer

**USE AT YOUR OWN RISK**

This software is provided "as is", without warranty of any kind, express or implied, including but not limited to the warranties of merchantability, fitness for a particular purpose and noninfringement. In no event shall the authors or copyright holders be liable for any claim, damages or other liability, whether in an action of contract, tort or otherwise, arising from, out of or in connection with the software or the use or other dealings in the software.

**Trading cryptocurrencies involves substantial risk of loss and is not suitable for every investor.** The value of cryptocurrencies may fluctuate, and you may lose some or all of your investment. Past performance is not indicative of future results. You should carefully consider whether trading cryptocurrencies is suitable for you in light of your circumstances, knowledge, and financial resources.

By using this software, you acknowledge that:
- You understand the risks involved in cryptocurrency trading
- You are solely responsible for any trading decisions made
- The authors and contributors are not responsible for any financial losses
- You will not hold the authors liable for any damages arising from the use of this software

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
